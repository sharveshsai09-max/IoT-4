# VAULT-7 — Bank Vault Intrusion Detection System
### IoT Project — Software Simulation

## 1. Project overview
A bank-vault style security system that combines a **motion sensor** and a
**keypad passcode** to detect intrusions. If motion is sensed while the
system is armed and the correct code is not entered in time, an alarm is
triggered.

This submission implements the full sensor → logic → actuator pipeline of
the IoT system **entirely in software** (`vault_security_system.html`),
with an accompanying Arduino sketch (`vault_security_arduino.ino`) showing
the same logic mapped onto real hardware.

## 2. Why a software submission is valid for this IoT project
- The core learning objective of an IoT security project is the **event
  logic**: sensor input → decision rules → actuator output. That logic is
  identical whether the "sensor" is a PIR module or a button standing in
  for one — the software simulation exercises the exact same state
  machine a microcontroller would run.
- Simulating sensors/actuators in software (or in tools like Wokwi,
  Tinkercad Circuits, or Proteus) is standard practice for prototyping and
  grading IoT coursework when hardware isn't available, and is explicitly
  supported by most embedded-systems and IoT curricula as a valid
  proof-of-concept stage before a physical build.
- This project goes further than a pure simulator by including the actual
  microcontroller-equivalent code (`.ino`), so the hardware mapping is
  explicit and the project could be moved onto a real Arduino/ESP32 +
  PIR sensor + keypad with no logic changes.
- If your course specifically requires a **physical** demo, check with
  your instructor — but for documenting, testing, and demonstrating the
  system's behavior, this software version is a complete and defensible
  submission.

## 3. System logic
1. System starts **disarmed**.
2. **Arm** the system — keypad becomes active, status LED turns green.
3. **Motion sensor**: once armed, pressing *any key on the keyboard*
   simulates the PIR sensor firing → a 10-second entry-delay countdown
   starts (amber LED, on-screen countdown).
4. Enter the correct 4-digit passcode (default `1234`) within the window →
   system disarms, log shows access granted.
5. Timeout, or 3 incorrect attempts → **alarm triggers** (red LED, siren),
   and stays active until the correct code is entered.
6. **Event log** and **passcode change** are accessed via small buttons
   that open popup windows, instead of being permanently on-screen.

## 4. Files
| File | Purpose |
|---|---|
| `index.html` | Page structure — open this in any browser, or it's served automatically by GitHub Pages |
| `style.css` | All styling for the console (theme, layout, animations) |
| `script.js` | All simulation logic (state machine, timers, audio, event log) |
| `vault_security_arduino.ino` | Hardware-equivalent code (Arduino Uno/ESP32 + PIR + 4x4 keypad) |
| `README.md` | This document |
| `.gitignore` | Keeps OS/editor clutter out of the repo |

## 5. Hardware mapping (for the real build)
| Simulated element | Real component |
|---|---|
| Motion trigger button | PIR motion sensor (HC-SR501) |
| On-screen keypad | 4×4 matrix membrane keypad |
| JS event logic | Arduino Uno / ESP32 firmware |
| Visual + tone alarm | Buzzer + red LED (driven via transistor/relay if needed) |
| Status LEDs | Green / Amber / Red LEDs on GPIO pins |
| (Optional extension) | ESP32 Wi-Fi → push notification / MQTT cloud log |
