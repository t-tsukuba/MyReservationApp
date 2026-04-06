package com.example.myapp;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Controller
public class ReservationController {

    private final String reservationsPath = "src/main/resources/reservations/reservations.json";
    //private final String reservationsPath = "/home/hiejima/Desktop/MyReservationApp/build/resources/main/reservations/reservations.json";  // ラズパイ用

    private final String logPath = "src/main/resources/reservations/reservations-log.json";
    //private final String logPath = "/home/hiejima/Desktop/MyReservationApp/build/resources/main/reservations/reservations-log.json";  // ラズパイ用

    private final String usersPath = "src/main/resources/reservations/users.json";
    //private final String usersPath = "/home/hiejima/Desktop/MyReservationApp/build/resources/main/reservations/users.json";  // ラズパイ用

    private boolean initialized = false;
    private List<ReservationLog> logList = new ArrayList<>();
    private Map<String, Integer> userFreq = new HashMap<>();

    @Autowired
    private ReservationService reservationService;

    @GetMapping({"/", "/reservation"})
    public String reservationForm(Model model) {
        if (!initialized) {
            List<ReservationElement> saved = reservationService.readReservations(reservationsPath);
            saved.forEach(r -> reservationService.addReservation(r));
            logList = new ArrayList<>(reservationService.readLogs(logPath));
            userFreq = new HashMap<>(reservationService.readUsers(usersPath));
            initialized = true;
        }
        return "reservation";
    }

    @GetMapping("/reservations")
    @ResponseBody
    public List<ReservationElement> getReservations() {
        return reservationService.getAllReservations();
    }

    @PostMapping("/reservations")
    @ResponseBody
    public ReservationElement createReservation(@RequestBody ReservationElement reservation) {
        reservation.setId(genId());
        reservationService.addReservation(reservation);
        reservationService.writeReservations(reservationsPath, reservationService.getAllReservations());
        return reservation;
    }

    @PutMapping("/reservations/{id}")
    @ResponseBody
    public ResponseEntity<ReservationElement> updateReservation(@PathVariable String id,
                                                                 @RequestBody ReservationElement reservation) {
        reservation.setId(id);
        reservationService.updateReservation(id, reservation);
        reservationService.writeReservations(reservationsPath, reservationService.getAllReservations());
        return ResponseEntity.ok(reservation);
    }

    @DeleteMapping("/reservations/{id}")
    @ResponseBody
    public ResponseEntity<Void> deleteReservation(@PathVariable String id) {
        reservationService.removeReservation(id);
        reservationService.writeReservations(reservationsPath, reservationService.getAllReservations());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/logs")
    @ResponseBody
    public List<ReservationLog> getLogs() {
        return logList;
    }

    @PostMapping("/logs")
    @ResponseBody
    public ResponseEntity<Void> addLog(@RequestBody ReservationLog log) {
        logList.add(0, log);
        if (logList.size() > 1000) logList = new ArrayList<>(logList.subList(0, 1000));
        reservationService.writeLogs(logPath, logList);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/logs")
    @ResponseBody
    public ResponseEntity<Void> clearLogs() {
        logList.clear();
        reservationService.writeLogs(logPath, logList);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/users")
    @ResponseBody
    public Map<String, Integer> getUsers() {
        return userFreq;
    }

    @PostMapping("/users/{name}")
    @ResponseBody
    public ResponseEntity<Void> addUser(@PathVariable String name) {
        userFreq.put(name, userFreq.getOrDefault(name, 0) + 1);
        if (userFreq.size() > 20) {
            userFreq = userFreq.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(20)
                    .collect(Collectors.toMap(
                            Map.Entry::getKey, Map.Entry::getValue,
                            (e1, e2) -> e1, LinkedHashMap::new));
        }
        reservationService.writeUsers(usersPath, userFreq);
        return ResponseEntity.ok().build();
    }

    private String genId() {
        return Long.toString(System.currentTimeMillis(), 36)
                + Long.toString(Math.abs(new Random().nextLong()), 36);
    }
}
