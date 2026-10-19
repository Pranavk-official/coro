import ReplayKit

/// Broadcast Upload Extension entry point (spec 008 FR7). ReplayKit hands us the whole phone screen; SharePeer
/// joins the call as a share-only session and sends it. Runs in its own process with a ~50 MB memory cap.
class SampleHandler: RPBroadcastSampleHandler {
    private var peer: SharePeer?

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        guard let call = ShareHandoff.load() else {
            return end("Start presenting from a Coro call.")
        }
        ShareHandoff.observe(ShareHandoff.stopNote, self) { _, observer, _, _, _ in
            guard let observer else { return }
            Unmanaged<SampleHandler>.fromOpaque(observer).takeUnretainedValue().end("Stopped presenting.", reason: "user")
        }
        peer = SharePeer(call: call) { [weak self] reason in
            self?.end("Presenting ended (\(reason)).", reason: reason)
        }
        peer?.start()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with type: RPSampleBufferType) {
        if type == .video { peer?.push(sampleBuffer) }
    }

    override func broadcastFinished() {
        stopPeer(reason: "system") // status-bar red pill / Control Center stop
    }

    private func stopPeer(reason: String) {
        guard let p = peer else { return }
        peer = nil
        p.stop()
        if ShareHandoff.stopReason == nil { ShareHandoff.stopReason = reason }
        ShareHandoff.post(ShareHandoff.stoppedNote)
    }

    /// Every stop path (FR5): tell the app, then end the broadcast (iOS shows `message`).
    private func end(_ message: String, reason: String = "error") {
        stopPeer(reason: reason)
        finishBroadcastWithError(NSError(domain: "app.coro.meet", code: 0, userInfo: [NSLocalizedDescriptionKey: message]))
    }
}
