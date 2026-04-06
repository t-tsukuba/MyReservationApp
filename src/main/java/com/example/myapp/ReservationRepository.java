package com.example.myapp;

import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class ReservationRepository {
    private List<ReservationElement> reservations = new ArrayList<>();

    public void save(ReservationElement reservation) {
        reservations.add(reservation);
    }

    public void remove(String id) {
        reservations.removeIf(r -> id.equals(r.getId()));
    }

    public void removeAll() {
        reservations.clear();
    }

    public List<ReservationElement> findAll() {
        return reservations;
    }

    public Optional<ReservationElement> findById(String id) {
        return reservations.stream().filter(r -> id.equals(r.getId())).findFirst();
    }

    public void update(String id, ReservationElement updated) {
        for (int i = 0; i < reservations.size(); i++) {
            if (id.equals(reservations.get(i).getId())) {
                reservations.set(i, updated);
                return;
            }
        }
    }
}
