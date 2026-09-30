package com.kiemas.app;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Recibe lo que otras apps «comparten» con Kiemas (ACTION_SEND, text/plain).
 *
 * El caso que importa es «Compartir» desde Google Maps: llega un texto con el
 * enlace del sitio. Aquí solo se guarda ese texto; decidir si es un enlace de
 * mapas, resolverlo y rellenar el formulario es cosa de la web, que ya lo hace.
 *
 * Hay dos caminos y los dos son necesarios:
 *   · App cerrada: la web todavía no ha cargado cuando llega el intent, así que
 *     el texto se queda guardado y la web lo pide con `getPending()` al arrancar.
 *   · App abierta: llega un intent nuevo y se avisa con el evento `shareReceived`.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static String pending = null;
    private static ShareTargetPlugin instance = null;

    @Override
    public void load() {
        instance = this;
    }

    /** Llamado desde MainActivity con cada intent que recibe. */
    static void handleIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;

        // Se consume: si Android reentrega el mismo intent al reanudar, no se
        // importaría dos veces.
        intent.setAction(Intent.ACTION_MAIN);
        intent.removeExtra(Intent.EXTRA_TEXT);

        pending = text;
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("text", text);
            instance.notifyListeners("shareReceived", data, true);
        }
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", pending == null ? "" : pending);
        pending = null;
        call.resolve(ret);
    }
}
