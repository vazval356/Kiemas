package com.kiemas.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios se registran ANTES de super.onCreate(): es cuando
        // el puente se construye y lee la lista. Hacerlo después compila igual
        // pero la web no encuentra el plugin en tiempo de ejecución.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
        // Arranque en frío desde «Compartir»: el intent llega aquí, no a onNewIntent.
        ShareTargetPlugin.handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Con la app ya abierta (`singleTask`) el intent nuevo llega por aquí.
        ShareTargetPlugin.handleIntent(intent);
    }
}
