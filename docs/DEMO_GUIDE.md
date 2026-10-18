# NamPS OS — Interactive Demo Guide (DEMO_MODE only)

> This walkthrough needs `DEMO_MODE=true` and `FEATURES=all`. Production runs without both; see PILOT_GUIDE.md and DEPLOYMENT.md.

## 1. Entering the Interactive Demonstration
The public deployment operates with `DEMO MODE` enabled.
- A prominent amber **DEMO REJIMI** badge is displayed on the top navigation bar.
- Visitors can explore all 5 major school personas using the **Rolni almashtirish (Switch Role)** dropdown without needing separate login screens or passwords.

---

## 2. Role Walkthrough Scenarios

### Scenario A: The Student Experience
1. Select **O'quvchi (Student)** from the top role switcher (loads Azamat Toirov, 10-A).
2. **Timetable**: View today's schedule (Monday 08:30 Math in Room 302, Physics in Lab 1, English in Room 204).
3. **Assignments**: Open "Kengaytirilgan Matematika", view the already submitted solution with the teacher's published grade (**95/100**) and written praise.
4. **Submit Work**: Select an ungraded assignment, type a response, and submit.
5. **Workload Calendar**: Inspect the workload graph. Notice the warning on October 25 where multiple heavy deadlines coincide (>120 mins) and test the "Propose Reschedule" button.

### Scenario B: Truly Anonymous Suggestion Workflow
1. Navigate to **Anonim taklif yuborish** (works for any visitor without logging in).
2. Select category (e.g. *Facilities & Equipment*), enter title and constructive text.
3. Click **"Anonim tarzda yuborish"**.
4. Observe the generated **Public Receipt Code** (e.g. `NPS-7K9W2B4X`) and **Secret Token** (`sec_...`). Copy them.
5. Switch role to **Direktor (Director)** or **Menejer (Manager)**.
6. Open **"Anonim takliflar (Ko'rib chiqish)"**.
7. Locate the new suggestion in the queue. Note that **NO author name, email, or IP address** appears anywhere.
8. Change status to `Approved` or `In Progress`, enter an official response, and save.
9. Return to the anonymous status page, enter the receipt code and secret token, and verify that the student can immediately see the updated status and official response!

### Scenario C: The Teacher Experience
1. Switch to **O'qituvchi (Teacher)** (loads Jasur Rahimov).
2. Click **Vazifalar va baholash** -> **Yangi vazifa yaratish** (Create Assignment).
3. Enter title, due date, estimated completion time (mins), and instructions.
4. Open the student submission queue, review Azamat's homework, adjust grade or write feedback, and publish.
5. Open **Davomat daftari** (Attendance ledger), change a student status to `Late` or `Excused`, and click **Saqlash** (Save).

### Scenario D: The Parent / Guardian Experience
1. Switch to **Ota-ona (Parent)** (loads Farhod Toirov).
2. Observe verified child linkage to Azamat Toirov (10-A).
3. View child's academic GPA, attendance rate (97.5%), recent published grades, and upcoming deadlines.
4. Confirm that no other students' records or anonymous suggestions are accessible.

### Scenario E: Safe Demo Reset
- Click the red **"Demoning holatini tiklash"** button in the top bar.
- Confirm the dialog.
- The system resets all fictional data back to its pristine seed state without affecting system stability.
