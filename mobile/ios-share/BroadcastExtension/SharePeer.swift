import CoreMedia
import Foundation
import ReplayKit
import SocketIO
import WebRTC

/// Spec 008 native share-only peer, iOS port of mobile/android/.../share/SharePeer.java (keep them in step).
/// Joins the call as a second session of the same user (`here: "also"`), sends only the phone screen in a stream
/// whose id is the web call's `screenId` (spec 007 FR3), and mirrors src/lib/webrtc/peer.ts: perfect negotiation,
/// the polite side never makes the first offer, inbound signals applied one at a time (serial `queue`).
final class SharePeer: NSObject {
    private let call: ShareHandoff.Call
    private let onEnd: (String) -> Void
    private let queue = DispatchQueue(label: "app.coro.meet.share")
    private var ended = false

    private let factory: RTCPeerConnectionFactory
    private let source: RTCVideoSource
    private let capturer: RTCVideoCapturer
    private let track: RTCVideoTrack
    private var ice: [RTCIceServer] = []
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var peers: [String: Remote] = [:]

    private final class Remote: NSObject, RTCPeerConnectionDelegate {
        let id: String
        let polite: Bool
        var pc: RTCPeerConnection!
        var makingOffer = false
        var ignoreOffer = false
        weak var owner: SharePeer?

        init(id: String, polite: Bool) {
            self.id = id
            self.polite = polite
        }

        func peerConnectionShouldNegotiate(_ pc: RTCPeerConnection) { owner?.queue.async { self.owner?.negotiate(self) } }
        func peerConnection(_ pc: RTCPeerConnection, didGenerate c: RTCIceCandidate) {
            owner?.send(id, ["candidate": ["candidate": c.sdp, "sdpMid": c.sdpMid ?? "", "sdpMLineIndex": c.sdpMLineIndex]])
        }
        func peerConnection(_ pc: RTCPeerConnection, didChange s: RTCSignalingState) {}
        func peerConnection(_ pc: RTCPeerConnection, didAdd s: RTCMediaStream) {}
        func peerConnection(_ pc: RTCPeerConnection, didRemove s: RTCMediaStream) {}
        func peerConnection(_ pc: RTCPeerConnection, didChange s: RTCIceConnectionState) {}
        func peerConnection(_ pc: RTCPeerConnection, didChange s: RTCIceGatheringState) {}
        func peerConnection(_ pc: RTCPeerConnection, didRemove c: [RTCIceCandidate]) {}
        func peerConnection(_ pc: RTCPeerConnection, didOpen d: RTCDataChannel) {}
    }

    init(call: ShareHandoff.Call, onEnd: @escaping (String) -> Void) {
        self.call = call
        self.onEnd = onEnd
        RTCInitializeSSL()
        factory = RTCPeerConnectionFactory(encoderFactory: RTCDefaultVideoEncoderFactory(),
                                           decoderFactory: RTCDefaultVideoDecoderFactory())
        source = factory.videoSource(forScreenCast: true)
        // 720p-class at 15 fps: the mesh encodes the screen once per viewer, and the extension has ~50 MB.
        source.adaptOutputFormat(toWidth: 720, height: 1280, fps: 15)
        capturer = RTCVideoCapturer(delegate: source)
        track = factory.videoTrack(with: source, trackId: "screen")
        super.init()
    }

    func start() {
        queue.async {
            do {
                self.ice = try self.fetchIce()
                self.connect()
            } catch {
                self.end("error")
            }
        }
    }

    /// Local stop (broadcast finished / user): no callback.
    func stop() {
        queue.async {
            guard !self.ended else { return }
            self.ended = true
            self.release()
        }
    }

    private func end(_ reason: String) {
        queue.async {
            guard !self.ended else { return }
            self.ended = true
            self.release()
            DispatchQueue.main.async { self.onEnd(reason) }
        }
    }

    /// ReplayKit frame → WebRTC. Called on ReplayKit's thread.
    func push(_ sample: CMSampleBuffer) {
        guard let pixels = CMSampleBufferGetImageBuffer(sample) else { return }
        let ns = Int64(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample)) * 1_000_000_000)
        var rotation = RTCVideoRotation._0
        if let o = CMGetAttachment(sample, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber {
            switch CGImagePropertyOrientation(rawValue: o.uint32Value) {
            case .left: rotation = ._90
            case .down: rotation = ._180
            case .right: rotation = ._270
            default: rotation = ._0
            }
        }
        let frame = RTCVideoFrame(buffer: RTCCVPixelBuffer(pixelBuffer: pixels), rotation: rotation, timeStampNs: ns)
        source.capturer(capturer, didCapture: frame)
    }

    // MARK: signaling

    private var state: [String: Any] { ["mic": false, "cam": false, "screen": true, "screenId": call.screenId] }

    private func connect() {
        guard let url = URL(string: call.origin) else { return end("error") }
        let manager = SocketManager(socketURL: url, config: [
            .forceWebsockets(true), .reconnects(false), .extraHeaders(["Cookie": call.cookie]),
        ])
        let s = manager.defaultSocket
        self.manager = manager
        socket = s
        s.on(clientEvent: .connect) { [weak self] _, _ in self?.queue.async { self?.join() } }
        s.on(clientEvent: .error) { [weak self] _, _ in self?.end("connect_error") }
        s.on(clientEvent: .disconnect) { [weak self] _, _ in self?.end("disconnected") }
        s.on("peer:joined") { [weak self] d, _ in
            guard let p = d.first as? [String: Any], let id = p["id"] as? String else { return }
            self?.queue.async { self?.addPeer(id, polite: false) }
        }
        s.on("peer:left") { [weak self] d, _ in
            guard let id = d.first as? String else { return }
            self?.queue.async { self?.dropPeer(id) }
        }
        s.on("signal") { [weak self] d, _ in
            guard d.count >= 2, let from = d[0] as? String, let data = d[1] as? [String: Any] else { return }
            self?.queue.async { self?.onSignal(from, data) }
        }
        s.on("share:stop") { [weak self] d, _ in self?.end(d.first as? String ?? "takeover") }
        s.on("kicked") { [weak self] _, _ in self?.end("kicked") }
        s.on("room:ended") { [weak self] _, _ in self?.end("ended") }
        s.on("moved") { [weak self] _, _ in self?.end("moved") }
        s.connect()
    }

    private func join() {
        guard let s = socket else { return }
        // State first, so everyone's peer:joined already marks us share-only (spec 008 FR8, no server change).
        s.emit("state", state)
        var opts: [String: Any] = ["here": "also"]
        if let t = call.joinToken { opts["joinToken"] = t }
        s.emitWithAck("room:join", call.code, opts).timingOut(after: 10) { [weak self] data in
            self?.queue.async { self?.onJoined(data.first as? [String: Any]) }
        }
    }

    private func onJoined(_ r: [String: Any]?) {
        guard let r, r["ok"] as? Bool == true else { return end("join_\((r?["error"] as? String) ?? "timeout")") }
        guard r["status"] as? String == "admitted" else { return end("waiting") }
        for p in (r["peers"] as? [[String: Any]]) ?? [] { if let id = p["id"] as? String { addPeer(id, polite: true) } }
        socket?.emit("state", state) // in the room now: takes the presenter slot (spec 007 FR6)
    }

    // MARK: peers

    private func addPeer(_ id: String, polite: Bool) {
        guard !ended, peers[id] == nil else { return }
        let r = Remote(id: id, polite: polite)
        r.owner = self
        let cfg = RTCConfiguration()
        cfg.iceServers = ice
        cfg.sdpSemantics = .unifiedPlan
        guard let pc = factory.peerConnection(with: cfg, constraints: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil), delegate: r) else { return }
        r.pc = pc
        // Send only: the phone shouldn't also download everyone's video (spec 008 D7).
        let init_ = RTCRtpTransceiverInit()
        init_.direction = .sendOnly
        init_.streamIds = [call.screenId]
        pc.addTransceiver(with: track, init: init_)
        peers[id] = r
    }

    private func dropPeer(_ id: String) {
        peers.removeValue(forKey: id)?.pc.close()
    }

    private func negotiate(_ r: Remote) {
        guard peers[r.id] === r else { return }
        // Same rule as peer.ts: the first offer comes from the impolite side only.
        if r.polite && r.pc.remoteDescription == nil { return }
        r.makingOffer = true
        defer { r.makingOffer = false }
        guard wait({ done in r.pc.setLocalDescription(completionHandler: done) }), let d = r.pc.localDescription else { return }
        send(r.id, describe(d))
    }

    private func onSignal(_ from: String, _ data: [String: Any]) {
        guard let r = peers[from] else { return }
        if let d = data["description"] as? [String: Any], let type = d["type"] as? String, let sdp = d["sdp"] as? String {
            let desc = RTCSessionDescription(type: RTCSessionDescription.type(for: type), sdp: sdp)
            let offer = desc.type == .offer
            let collision = offer && (r.makingOffer || r.pc.signalingState != .stable)
            r.ignoreOffer = !r.polite && collision
            if r.ignoreOffer { return }
            if collision {
                _ = wait { done in r.pc.setLocalDescription(RTCSessionDescription(type: .rollback, sdp: ""), completionHandler: done) }
            }
            guard wait({ done in r.pc.setRemoteDescription(desc, completionHandler: done) }) else { return }
            if offer, wait({ done in r.pc.setLocalDescription(completionHandler: done) }), let a = r.pc.localDescription {
                send(r.id, describe(a))
            }
        } else if let c = data["candidate"] as? [String: Any], let sdp = c["candidate"] as? String {
            let cand = RTCIceCandidate(sdp: sdp, sdpMLineIndex: Int32(c["sdpMLineIndex"] as? Int ?? 0), sdpMid: c["sdpMid"] as? String)
            r.pc.add(cand) { _ in } // a candidate for an ignored offer may fail: fine
        }
    }

    fileprivate func send(_ to: String, _ data: [String: Any]) {
        guard !ended else { return }
        socket?.emit("signal", to, data)
    }

    private func describe(_ d: RTCSessionDescription) -> [String: Any] {
        ["description": ["type": RTCSessionDescription.string(for: d.type), "sdp": d.sdp]]
    }

    /// Run one async SDP operation and wait for it (we're on `queue`; WebRTC calls back on its own thread).
    private func wait(_ op: (@escaping (Error?) -> Void) -> Void) -> Bool {
        let sem = DispatchSemaphore(value: 0)
        var ok = false
        op { err in
            ok = err == nil
            sem.signal()
        }
        return sem.wait(timeout: .now() + 10) == .success && ok
    }

    // MARK: ICE + teardown

    private func fetchIce() throws -> [RTCIceServer] {
        guard let url = URL(string: call.origin + "/api/ice-servers") else { return [] }
        var req = URLRequest(url: url)
        req.setValue(call.cookie, forHTTPHeaderField: "Cookie")
        var body: Data?
        let sem = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: req) { data, _, _ in
            body = data
            sem.signal()
        }.resume()
        _ = sem.wait(timeout: .now() + 10)
        guard let body, let list = try JSONSerialization.jsonObject(with: body) as? [[String: Any]] else { return [] }
        return list.compactMap { s in
            let urls = (s["urls"] as? [String]) ?? (s["urls"] as? String).map { [$0] } ?? []
            return urls.isEmpty ? nil : RTCIceServer(urlStrings: urls, username: s["username"] as? String,
                                                     credential: s["credential"] as? String)
        }
    }

    private func release() {
        socket?.removeAllHandlers()
        socket?.disconnect()
        for r in peers.values { r.pc.close() }
        peers.removeAll()
    }
}
