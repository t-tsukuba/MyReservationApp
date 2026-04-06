package com.example.myapp;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;

public class SettingLoader {
    private File file;
    
    public SettingLoader(String path){
        this.file = Path.of(path).toFile();
    }

    public List<String> readSetting() {
        List<String> settingList = new ArrayList<>();

        try (BufferedReader reader = Files.newBufferedReader(this.file.toPath(), StandardCharsets.UTF_8)) {
            for (String line; (line = reader.readLine()) != null; ) {
                String setting = line;
                settingList.add(setting);
            }
        } catch (IOException e) {
            System.out.println("ファイルが見つかりません");
        }

        return settingList;  //[mail,apikey]
    }

    public void writeSetting(List<String> settingList) {
        try (BufferedWriter writer = Files.newBufferedWriter(this.file.toPath(), StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING)) {
            int i = 0;
            for (String element : settingList) {
                if (i == 0) {
                    writer.write(element);
                    i++;
                } else {
                    writer.newLine();
                    writer.write(element);
                }
            }
        } catch (IOException e) {
            System.out.println("ファイルが見つかりません");
        }
    }
}
