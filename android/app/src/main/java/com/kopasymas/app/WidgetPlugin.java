package com.kopasymas.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente entre la aplicación web y el widget de pantalla de inicio.
 *
 * Solo guarda lo que le pasan y pide un repintado. La decisión de cuál es el
 * próximo plan, y cómo se escribe su fecha en el idioma de cada uno, se toma en
 * la web: allí ya están los datos, el idioma del perfil y el formateador del
 * navegador. Repetir eso en Java sería mantener dos veces la misma lógica para
 * que acabaran divergiendo.
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
            NextPlanWidget.PREFS,
            Context.MODE_PRIVATE
        );

        prefs
            .edit()
            .putString(NextPlanWidget.KEY_TITLE, call.getString("title", ""))
            .putString(NextPlanWidget.KEY_WHEN, call.getString("when", ""))
            .putString(NextPlanWidget.KEY_PLACE, call.getString("place", ""))
            .putString(NextPlanWidget.KEY_URL, call.getString("url", ""))
            .putString(NextPlanWidget.KEY_EMPTY, call.getString("emptyText", ""))
            // Milisegundos de época, y viajan como TEXTO a propósito.
            //
            // `PluginCall` solo ofrece getInt y getFloat para números. Un float
            // tiene siete dígitos significativos y una marca de tiempo tiene
            // trece: la fecha llegaría desviada por horas. Y un int se queda
            // corto en milisegundos. Un texto no tiene ninguno de los dos
            // problemas.
            .putLong(NextPlanWidget.KEY_STARTS_AT, parseMillis(call.getString("startsAt", "0")))
            .apply();

        NextPlanWidget.refreshAll(context);
        call.resolve();
    }

    /** Un valor ilegible se trata como «sin fecha», no como una excepción. */
    private static long parseMillis(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
