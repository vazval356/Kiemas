package com.kiemas.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget de pantalla de inicio: el próximo plan del grupo.
 *
 * No habla con Supabase. La aplicación web calcula cuál es el próximo plan —que
 * ya lo sabe, porque lo tiene en pantalla— y se lo pasa por {@link WidgetPlugin},
 * que lo deja en SharedPreferences. Aquí solo se pinta.
 *
 * Es deliberado: para consultar la base de datos desde aquí habría que sacar el
 * token de sesión del WebView, renovarlo cuando caduca y repetir en Java la
 * lógica de permisos. Todo eso para enseñar tres líneas de texto.
 *
 * El precio es que el widget solo se entera de novedades cuando alguien abre la
 * app. A cambio, `updatePeriodMillis` lo despierta cada media hora, y en cada
 * repintado se comprueba si el plan guardado ya ha pasado: así no se queda
 * enseñando la cena del jueves durante el fin de semana.
 */
public class NextPlanWidget extends AppWidgetProvider {

    static final String PREFS = "kiemas_widget";
    static final String KEY_TITLE = "title";
    static final String KEY_WHEN = "when";
    static final String KEY_PLACE = "place";
    static final String KEY_URL = "url";
    static final String KEY_STARTS_AT = "startsAt";
    static final String KEY_EMPTY = "empty";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            render(context, manager, id);
        }
    }

    /** Repinta todas las instancias. La llama el plugin cuando llegan datos. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName me = new ComponentName(context, NextPlanWidget.class);
        for (int id : manager.getAppWidgetIds(me)) {
            render(context, manager, id);
        }
    }

    private static void render(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        String title = prefs.getString(KEY_TITLE, "");
        long startsAt = prefs.getLong(KEY_STARTS_AT, 0L);

        // Un plan que ya ha pasado deja de enseñarse aunque nadie haya abierto
        // la app para actualizarlo. Sin esto, el widget mentiría durante días.
        boolean hasPlan = !title.isEmpty() && (startsAt == 0L || startsAt > System.currentTimeMillis());

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_plan);

        if (hasPlan) {
            views.setViewVisibility(R.id.widget_plan, View.VISIBLE);
            views.setViewVisibility(R.id.widget_empty, View.GONE);
            views.setTextViewText(R.id.widget_title, title);
            views.setTextViewText(R.id.widget_when, prefs.getString(KEY_WHEN, ""));

            String place = prefs.getString(KEY_PLACE, "");
            views.setTextViewText(R.id.widget_place, place);
            // Un plan puede no tener sitio todavía («cañas donde sea»): se
            // esconde la línea en vez de dejar un hueco vacío.
            views.setViewVisibility(R.id.widget_place, place.isEmpty() ? View.GONE : View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_plan, View.GONE);
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);

            // El texto vacío llega traducido desde la web, que es donde vive el
            // idioma del perfil. Mientras nadie haya abierto la app queda el
            // valor por defecto de strings.xml.
            String empty = prefs.getString(KEY_EMPTY, "");
            if (!empty.isEmpty()) {
                views.setTextViewText(R.id.widget_empty, empty);
            }
        }

        views.setOnClickPendingIntent(R.id.widget_root, openApp(context, prefs, hasPlan));
        manager.updateAppWidget(widgetId, views);
    }

    /**
     * Tocar el widget abre la app donde toca.
     *
     * Se reutiliza el mismo mecanismo que los enlaces compartidos: un
     * ACTION_VIEW con la URL del plan, que Capacitor entrega a la web por
     * `appUrlOpen` y ésta convierte en una ruta interna. Así no hay un segundo
     * camino de navegación que mantener.
     */
    private static PendingIntent openApp(Context context, SharedPreferences prefs, boolean hasPlan) {
        String url = prefs.getString(KEY_URL, "");
        Intent intent;

        if (hasPlan && !url.isEmpty()) {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        } else {
            intent = new Intent(Intent.ACTION_MAIN);
        }
        intent.setClass(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // FLAG_IMMUTABLE es obligatorio desde Android 12: sin él la app revienta
        // al crear el PendingIntent.
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
