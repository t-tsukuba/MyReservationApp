package com.example.myapp;

public class ReservationElement {
    private String id;
    private String equipment;
    private String user;
    private String date;       // "YYYY-MM-DD"
    private String startTime;  // "HH:MM"
    private String endTime;    // "HH:MM"
    private String notes;
    private String pin;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEquipment() { return equipment; }
    public void setEquipment(String equipment) { this.equipment = equipment; }

    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
}
