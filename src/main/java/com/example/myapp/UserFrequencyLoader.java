package com.example.myapp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public class UserFrequencyLoader {
    private final File file;
    private static final ObjectMapper mapper = new ObjectMapper();

    public UserFrequencyLoader(String path) {
        this.file = Path.of(path).toFile();
    }

    public Map<String, Integer> readUsers() {
        if (!file.exists()) return new HashMap<>();
        try {
            return mapper.readValue(file, new TypeReference<Map<String, Integer>>() {});
        } catch (IOException e) {
            return new HashMap<>();
        }
    }

    public void writeUsers(Map<String, Integer> users) {
        try {
            if (file.getParentFile() != null) file.getParentFile().mkdirs();
            mapper.writerWithDefaultPrettyPrinter().writeValue(file, users);
        } catch (IOException e) {
            System.out.println("ユーザーファイルの書き込みに失敗しました: " + e.getMessage());
        }
    }
}
