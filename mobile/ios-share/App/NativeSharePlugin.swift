import Capacitor
import ReplayKit
import WebKit

/// Spec 008: phone screen share on iOS. The web call asks for it (src/lib/native/share.ts); iOS only starts a
/// screen broadcast from the system picker, so this hands the call to the Broadcast Upload Extension (App Group)
/// and opens the picker preselected on it. The extension runs the share-only peer.
@objc(NativeSharePlugin)
public class NativeSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSharePlugin"
    public let jsName = "NativeShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        ShareHandoff.observe(ShareHandoff.stoppedNote, self) { _, observer, _, _, _ in
            guard let observer else { return }
            let plugin = Unmanaged<NativeSharePlugin>.fromOpaque(observer).takeUnretainedValue()
            plugin.notifyListeners("stopped", data: ["reason": ShareHandoff.stopReason ?? "system"])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard let origin = call.getString("origin"), let code = call.getString("code"),
              let screenId = call.getString("screenId"), let host = URL(string: origin)?.host
        else { return call.reject("origin, code and screenId are required") }
        DispatchQueue.main.async {
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
                let cookie = cookies
                    .filter { host.hasSuffix($0.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))) }
                    .map { "\($0.name)=\($0.value)" }
                    .joined(separator: "; ")
                ShareHandoff.save(.init(origin: origin, code: code, screenId: screenId,
                                        joinToken: call.getString("joinToken"), cookie: cookie))
                self.showPicker()
                call.resolve()
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        ShareHandoff.post(ShareHandoff.stopNote)
        call.resolve()
    }

    /// No public API starts a broadcast: press the system picker's button for the user (Start Broadcast is theirs).
    private func showPicker() {
        guard let view = bridge?.viewController?.view else { return }
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
        picker.preferredExtension = ShareHandoff.extensionBundleId
        picker.showsMicrophoneButton = false
        picker.isHidden = true
        view.addSubview(picker)
        picker.subviews.compactMap { $0 as? UIButton }.first?.sendActions(for: .allTouchEvents)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { picker.removeFromSuperview() }
    }
}
