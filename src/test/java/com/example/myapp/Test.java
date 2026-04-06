package com.example.myapp;

import java.util.ArrayList;
import java.util.List;

public class Test {
    static class Testt {
        String name;
        int id;

        Testt(String name, int id) {
            this.name = name;
            this.id = id;
        }

        public void setName(String name) {
            this.name = name;
        }

        public void setId(int id) {
            this.id = id;
        }

        @Override
        public String toString() {
            return "Testt{" +
                    "name='" + name + '\'' +
                    ", id=" + id +
                    '}';
        }
    }

    public static class TestList {
        List<Testt> testList;

        TestList() {
            testList = new ArrayList<>();
        }

        public void add(Testt test) {
            testList.add(test);
        }

        public Testt foundTest(int id) {
            for (Testt test : testList) {
                if (id == test.id) {
                    return test;
                }
            }
            return null;
        }

        public void displayAll() {
            testList.forEach(System.out::println);
        }
    }

    ;

    public static void main(String[] args) {
        TestList testList = new TestList();
        testList.add(new Testt("a", 1));
        testList.add(new Testt("b", 2));
        testList.add(new Testt("c", 3));

        Testt foundTestt = testList.foundTest(1);
        foundTestt.setName("qq");

        testList.displayAll();
    }
}
