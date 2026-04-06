package com.example.myapp;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ReservationService {
    @Autowired
    private ReservationRepository reservationRepository;

    public void addReservation(ReservationElement reservation) {
        reservationRepository.save(reservation);
    }

    public void removeReservation(String id) {
        reservationRepository.remove(id);
    }

    public void removeAllReservations() {
        reservationRepository.removeAll();
    }

    public Optional<ReservationElement> findReservation(String id) {
        return reservationRepository.findById(id);
    }

    public List<ReservationElement> getAllReservations() {
        return reservationRepository.findAll();
    }

    public void updateReservation(String id, ReservationElement updated) {
        reservationRepository.update(id, updated);
    }

    public List<ReservationElement> readReservations(String path) {
        return new ReservationsLoader(path).readReservation();
    }

    public void writeReservations(String path, List<ReservationElement> list) {
        new ReservationsLoader(path).writeReservation(list);
    }

    public List<ReservationLog> readLogs(String path) {
        return new ReservationLogLoader(path).readLog();
    }

    public void writeLogs(String path, List<ReservationLog> logs) {
        new ReservationLogLoader(path).writeLog(logs);
    }

    public Map<String, Integer> readUsers(String path) {
        return new UserFrequencyLoader(path).readUsers();
    }

    public void writeUsers(String path, Map<String, Integer> users) {
        new UserFrequencyLoader(path).writeUsers(users);
    }
}
