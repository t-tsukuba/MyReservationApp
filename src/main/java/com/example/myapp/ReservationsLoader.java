package com.example.myapp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class ReservationsLoader {
    private final File file;
    private static final ObjectMapper mapper = new ObjectMapper();

    public ReservationsLoader(String path) {
        this.file = Path.of(path).toFile();
    }

    public List<ReservationElement> readReservation() {
        if (!file.exists()) return new ArrayList<>();
        try {
            return mapper.readValue(file, new TypeReference<List<ReservationElement>>() {});
        } catch (IOException e) {
            System.out.println("予約ファイルの読み込みに失敗しました: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    public void writeReservation(List<ReservationElement> list) {
        try {
            if (file.getParentFile() != null) file.getParentFile().mkdirs();
            mapper.writerWithDefaultPrettyPrinter().writeValue(file, list);
        } catch (IOException e) {
            System.out.println("予約ファイルの書き込みに失敗しました: " + e.getMessage());
        }
    }
}
