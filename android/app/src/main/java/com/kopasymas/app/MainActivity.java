package com.kopasymas.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios se registran ANTES de super.onCreate(): es cuando
        // el puente se construye y lee la lista. Hacerlo después compila igual
        // pero la web no encuentra el plugin en tiempo de ejecución.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
