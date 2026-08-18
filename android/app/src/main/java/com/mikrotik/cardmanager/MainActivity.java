package com.mikrotik.cardmanager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(MikroTikTransportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
