import UIKit
import UniformTypeIdentifiers

/// Extensión de «Compartir»: Kiemas aparece en la hoja de compartir de Google
/// Maps (y de cualquier app que comparta un enlace o un texto).
///
/// No enseña ninguna pantalla. Recoge el texto o la URL, abre la app con
/// `kiemas://import?text=…` y se cierra. La app se encarga del resto: buscar el
/// enlace de mapas dentro del texto, resolverlo y rellenar «Nuevo sitio».
final class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        recogerTexto { [weak self] texto in
            guard let self else { return }
            if let texto, let url = Self.urlDeLaApp(con: texto) {
                self.abrir(url)
            }
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }

    // MARK: - Recoger lo compartido

    /// Google Maps comparte texto («Nombre\nhttps://maps.app.goo.gl/…»); otras
    /// apps comparten una URL. Se acepta cualquiera de las dos.
    private func recogerTexto(_ fin: @escaping (String?) -> Void) {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let proveedores = items.flatMap { $0.attachments ?? [] }

        let texto = UTType.plainText.identifier
        let url = UTType.url.identifier

        if let p = proveedores.first(where: { $0.hasItemConformingToTypeIdentifier(texto) }) {
            p.loadItem(forTypeIdentifier: texto, options: nil) { valor, _ in
                DispatchQueue.main.async { fin(valor as? String) }
            }
        } else if let p = proveedores.first(where: { $0.hasItemConformingToTypeIdentifier(url) }) {
            p.loadItem(forTypeIdentifier: url, options: nil) { valor, _ in
                DispatchQueue.main.async { fin((valor as? URL)?.absoluteString) }
            }
        } else {
            fin(nil)
        }
    }

    private static func urlDeLaApp(con texto: String) -> URL? {
        var partes = URLComponents()
        partes.scheme = "kiemas"
        partes.host = "import"
        partes.queryItems = [URLQueryItem(name: "text", value: texto)]
        return partes.url
    }

    // MARK: - Abrir la app

    /// Una extensión no puede llamar a `UIApplication.shared.open`: el SDK lo
    /// marca como no disponible. Se sube por la cadena de respuesta hasta la
    /// `UIApplication` y se invoca `openURL:options:completionHandler:` por su
    /// nombre. Es el método habitual y sigue funcionando en iOS 18.
    private func abrir(_ url: URL) {
        typealias Abrir = @convention(c) (
            AnyObject, Selector, URL, [UIApplication.OpenExternalURLOptionsKey: Any], ((Bool) -> Void)?
        ) -> Void
        let selector = NSSelectorFromString("openURL:options:completionHandler:")

        var responder: UIResponder? = self
        while let actual = responder {
            if actual is UIApplication, let imp = actual.method(for: selector) {
                unsafeBitCast(imp, to: Abrir.self)(actual, selector, url, [:], nil)
                return
            }
            responder = actual.next
        }
    }
}
