import Foundation

/// Spec 008 FR7: the app and the broadcast extension are separate processes. They share the call details through
/// an App Group and signal each other with Darwin notifications. Add this file to BOTH targets.
enum ShareHandoff {
    static let appGroup = "group.app.coro.meet"
    static let extensionBundleId = "app.coro.meet.BroadcastExtension"

    /// app → extension: stop presenting (in-app Stop, call ended).
    static let stopNote = "app.coro.meet.share.stop"
    /// extension → app: presenting ended for any reason (system stop, takeover, host, kicked, ended).
    static let stoppedNote = "app.coro.meet.share.stopped"

    struct Call: Codable {
        let origin: String
        let code: String
        let screenId: String
        let joinToken: String?
        /// Same better-auth session as the WebView (spec 008 D6); never leaves the device except to `origin`.
        let cookie: String
    }

    private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    static func save(_ call: Call) {
        defaults?.set(try? JSONEncoder().encode(call), forKey: "call")
        defaults?.removeObject(forKey: "stopReason")
    }

    static func load() -> Call? {
        guard let data = defaults?.data(forKey: "call") else { return nil }
        return try? JSONDecoder().decode(Call.self, from: data)
    }

    static var stopReason: String? {
        get { defaults?.string(forKey: "stopReason") }
        set { defaults?.set(newValue, forKey: "stopReason") }
    }

    static func post(_ name: String) {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(), CFNotificationName(name as CFString), nil, nil, true)
    }

    static func observe(_ name: String, _ observer: AnyObject, _ callback: @escaping CFNotificationCallback) {
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(), Unmanaged.passUnretained(observer).toOpaque(), callback,
            name as CFString, nil, .deliverImmediately)
    }
}
