import UIKit
import UniformTypeIdentifiers

/// Extensión de «Compartir»: Kiemas aparece en la hoja de compartir de Apple
/// Maps, de Google Maps y de cualquier app que comparta un enlace o un texto.
///
/// No enseña ninguna pantalla. Recoge lo compartido, abre la app con
/// `kiemas://import?text=…` y se cierra. La app se encarga del resto: buscar el
/// enlace de mapas dentro del texto, resolverlo y rellenar «Nuevo sitio».
final class ShareViewController: UIViewController {

    /// Diagnóstico: enseña un aviso con lo recibido y si la app se ha podido
    /// abrir. Ponlo a `false` cuando todo funcione.
    private let diagnostico = false

    private var yaProcesado = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    // Aquí y no en `viewDidLoad`: hasta que la vista está en pantalla el
    // controlador no cuelga de la cadena de respuesta del sistema, y sin ella no
    // hay forma de llegar a la `UIApplication` para abrir la app. Antes se hacía
    // en `viewDidLoad` y la extensión se cerraba sin hacer nada.
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !yaProcesado else { return }
        yaProcesado = true

        recogerTexto { [weak self] texto in
            guard let self else { return }
            guard let texto, !texto.isEmpty else {
                self.avisar("No he recibido ningún texto ni enlace.") { self.terminar() }
                return
            }
            let resumen = String(texto.prefix(200))
            // Primero se enseña lo recibido y DESPUÉS se intenta abrir: si la
            // extensión se cae al abrir, al menos se sabe que llegó hasta aquí.
            self.avisar("Recibido:\n\(resumen)") {
                let abierta = Self.urlDeLaApp(con: texto).map { self.abrir($0) } ?? false
                if !abierta {
                    // Plan B: dejar el enlace copiado. Al abrir Kiemas a mano, la app
                    // lo detecta en el portapapeles y ofrece importarlo.
                    UIPasteboard.general.string = texto
                }
                let estado = abierta ? "sí" : "NO"
                self.avisar("App encontrada: \(estado)") {
                    self.terminar()
                }
            }
        }
    }

    private func avisar(_ mensaje: String, luego: @escaping () -> Void) {
        guard diagnostico else { luego(); return }
        let alerta = UIAlertController(title: "Kiemas (diagnóstico)", message: mensaje, preferredStyle: .alert)
        alerta.addAction(UIAlertAction(title: "OK", style: .default) { _ in luego() })
        present(alerta, animated: true)
    }

    private func terminar() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    // MARK: - Recoger lo compartido

    /// Apple Maps comparte una URL (y a veces una tarjeta de contacto); Google
    /// Maps comparte texto («Nombre\nhttps://maps.app.goo.gl/…»). Se lee TODO lo
    /// que venga como URL o como texto y se junta: si solo se mirara el primer
    /// tipo que coincide, se podía quedar el nombre del sitio sin el enlace.
    /// Las URL van primero, que es lo que la app busca.
    private func recogerTexto(_ fin: @escaping (String?) -> Void) {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let proveedores = items.flatMap { $0.attachments ?? [] }

        let tipoUrl = UTType.url.identifier
        let tipoTexto = UTType.plainText.identifier

        var urls: [String] = []
        var textos: [String] = []
        let grupo = DispatchGroup()
        let candado = NSLock()

        for proveedor in proveedores {
            if proveedor.hasItemConformingToTypeIdentifier(tipoUrl) {
                grupo.enter()
                proveedor.loadItem(forTypeIdentifier: tipoUrl, options: nil) { valor, _ in
                    let texto = (valor as? URL)?.absoluteString ?? (valor as? String)
                    if let texto {
                        candado.lock(); urls.append(texto); candado.unlock()
                    }
                    grupo.leave()
                }
            }
            if proveedor.hasItemConformingToTypeIdentifier(tipoTexto) {
                grupo.enter()
                proveedor.loadItem(forTypeIdentifier: tipoTexto, options: nil) { valor, _ in
                    if let texto = valor as? String {
                        candado.lock(); textos.append(texto); candado.unlock()
                    }
                    grupo.leave()
                }
            }
        }

        grupo.notify(queue: .main) {
            let todo = (urls + textos).joined(separator: "\n")
            fin(todo.isEmpty ? nil : todo)
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
    /// marca como no disponible. Se sube por la cadena de respuesta hasta quien
    /// entienda `openURL:options:completionHandler:` (la `UIApplication`) y se
    /// invoca por su nombre. Devuelve si ha encontrado a quién pedírselo.
    @discardableResult
    private func abrir(_ url: URL) -> Bool {
        // Tipos de Objective-C (`NSURL`, `NSDictionary`) y no los de Swift: la
        // llamada va por puntero de función y iOS espera objetos, no estructuras
        // de Swift. Con `URL` y `[:]` la extensión podía caerse aquí.
        typealias Abrir = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
        let selector = NSSelectorFromString("openURL:options:completionHandler:")

        // Solo la `UIApplication`: la `UIWindowScene` va antes en la cadena y
        // también tiene `openURL:options:completionHandler:`, pero espera un
        // `UISceneOpenExternalURLOptions` y con un diccionario la extensión se
        // cae (informe de fallo: doesNotRecognizeSelector en -[UIScene openURL…]).
        var responder: UIResponder? = self
        while let actual = responder {
            if actual is UIApplication, actual.responds(to: selector), let imp = actual.method(for: selector) {
                unsafeBitCast(imp, to: Abrir.self)(actual, selector, url as NSURL, NSDictionary(), nil)
                return true
            }
            responder = actual.next
        }
        return false
    }
}
