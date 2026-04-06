package com.example.myapp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class ReservationLogLoader {
    private final File file;
    private static final ObjectMapper mapper = new ObjectMapper();
    private static final int MAX_LOGS = 1000;

    public ReservationLogLoader(String path) {
        this.file = Path.of(path).toFile();
    }

    public List<ReservationLog> readLog() {
        if (!file.exists()) return new ArrayList<>();
        try {
            return mapper.readValue(file, new TypeReference<List<ReservationLog>>() {});
        } catch (IOException e) {
            System.out.println("ログファイルの読み込みに失敗しました: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    public void writeLog(List<ReservationLog> logs) {
        try {
            if (file.getParentFile() != null) file.getParentFile().mkdirs();
            List<ReservationLog> toWrite = logs.size() > MAX_LOGS ? logs.subList(0, MAX_LOGS) : logs;
            mapper.writerWithDefaultPrettyPrinter().writeValue(file, toWrite);
        } catch (IOException e) {
            System.out.println("ログファイルの書き込みに失敗しました: " + e.getMessage());
        }
    }
}
