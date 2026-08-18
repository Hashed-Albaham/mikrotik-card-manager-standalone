package com.mikrotik.cardmanager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "MikroTikTransport")
public class MikroTikTransportPlugin extends Plugin {
    @PluginMethod
    public void sendBatch(PluginCall call) {
        String host = call.getString("host");
        String username = call.getString("username");
        String password = call.getString("password");
        String script = call.getString("script");
        int port = call.getInt("port", 8728);
        String scriptName = call.getString("scriptName", "card_batch_" + UUID.randomUUID().toString().replace("-", ""));
        if (host == null || username == null || password == null || script == null || host.isBlank() || username.isBlank() || script.isBlank()) {
            call.reject("بيانات اتصال أو سكربت الدفعة غير مكتملة.");
            return;
        }
        if (port == 8729) {
            call.reject("نسخة APK تستخدم API على المنفذ 8728 داخل الشبكة المحلية. غيّر المنفذ أو استخدم نسخة سطح المكتب لـ API-SSL.");
            return;
        }
        new Thread(() -> {
            try (RouterApi api = new RouterApi(host, port)) {
                api.login(username, password);
                api.command("/system/script/add", "=name=" + scriptName, "=source=" + script, "=comment=Card batch");
                api.command("/system/script/run", "=number=" + scriptName);
                JSObject result = new JSObject();
                result.put("scriptName", scriptName);
                result.put("status", "sent");
                call.resolve(result);
            } catch (Exception error) {
                call.reject("تعذر حفظ أو تشغيل سكربت الدفعة: " + error.getMessage(), error);
            }
        }).start();
    }

    private static final class RouterApi implements AutoCloseable {
        private final Socket socket;
        private final BufferedInputStream input;
        private final BufferedOutputStream output;

        RouterApi(String host, int port) throws IOException {
            socket = new Socket(host, port);
            socket.setSoTimeout(15_000);
            input = new BufferedInputStream(socket.getInputStream());
            output = new BufferedOutputStream(socket.getOutputStream());
        }

        void login(String username, String password) throws IOException {
            command("/login", "=name=" + username, "=password=" + password);
        }

        void command(String... words) throws IOException {
            for (String word : words) writeWord(word);
            writeLength(0);
            output.flush();
            while (true) {
                List<String> sentence = readSentence();
                if (sentence.isEmpty()) continue;
                String type = sentence.get(0);
                if ("!done".equals(type)) return;
                if ("!trap".equals(type) || "!fatal".equals(type)) throw new IOException(String.join(" ", sentence));
            }
        }

        private void writeWord(String word) throws IOException {
            byte[] bytes = word.getBytes(StandardCharsets.UTF_8);
            writeLength(bytes.length);
            output.write(bytes);
        }

        private void writeLength(int length) throws IOException {
            if (length < 0x80) output.write(length);
            else if (length < 0x4000) { output.write((length >> 8) | 0x80); output.write(length & 0xFF); }
            else if (length < 0x200000) { output.write((length >> 16) | 0xC0); output.write((length >> 8) & 0xFF); output.write(length & 0xFF); }
            else if (length < 0x10000000) { output.write((length >> 24) | 0xE0); output.write((length >> 16) & 0xFF); output.write((length >> 8) & 0xFF); output.write(length & 0xFF); }
            else { output.write(0xF0); output.write((length >> 24) & 0xFF); output.write((length >> 16) & 0xFF); output.write((length >> 8) & 0xFF); output.write(length & 0xFF); }
        }

        private int readLength() throws IOException {
            int first = input.read(); if (first < 0) throw new IOException("انقطع الاتصال بالراوتر.");
            if ((first & 0x80) == 0) return first;
            if ((first & 0xC0) == 0x80) return ((first & 0x3F) << 8) | input.read();
            if ((first & 0xE0) == 0xC0) return ((first & 0x1F) << 16) | (input.read() << 8) | input.read();
            if ((first & 0xF0) == 0xE0) return ((first & 0x0F) << 24) | (input.read() << 16) | (input.read() << 8) | input.read();
            return (input.read() << 24) | (input.read() << 16) | (input.read() << 8) | input.read();
        }

        private List<String> readSentence() throws IOException {
            List<String> words = new ArrayList<>();
            while (true) { int length = readLength(); if (length == 0) return words; byte[] data = input.readNBytes(length); if (data.length != length) throw new IOException("بيانات API غير مكتملة."); words.add(new String(data, StandardCharsets.UTF_8)); }
        }

        @Override public void close() throws IOException { socket.close(); }
    }
}
