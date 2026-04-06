package com.example.myapp;

public class ReservationLog {
    private String id;
    private long ts;
    private String action; // "create", "edit", "delete"
    private ReservationElement res;
    private ReservationElement prev;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public long getTs() { return ts; }
    public void setTs(long ts) { this.ts = ts; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public ReservationElement getRes() { return res; }
    public void setRes(ReservationElement res) { this.res = res; }

    public ReservationElement getPrev() { return prev; }
    public void setPrev(ReservationElement prev) { this.prev = prev; }
}
