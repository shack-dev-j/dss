# NamPS OS — Pilot guide (one real week, one or two classes)

Goal: find out what breaks or confuses people with **real** classes before the whole school uses it.

## Before the week (administrator, ~half a day)
1. Deploy following `docs/DEPLOYMENT.md`; finish its security checklist; run `./scripts/verify-restore.sh`.
2. Enter terms, subjects, grading scale (get the school's decision: 5-point or percent, thresholds).
3. Import the pilot classes' student lists (CSV), create the pilot teachers, appoint class teachers, connect teachers to subjects,
   enter the weekly timetable. Print the one-time passwords and hand them out privately.
4. 20-minute walkthrough with each pilot teacher: **attendance register**, **creating an assessment and entering marks** (aim: a full
   class in under 1 minute), **posting homework**. Give students 5 minutes: login → change password → today's homework → marks.

## During the week — what to watch
| Check | How |
|---|---|
| Every lesson's attendance is recorded the same day | Attendance → Class summary; export CSV on Friday |
| Marks entry takes < 1 minute per class | Ask teachers; time one of them |
| Students find today's homework in < 10 seconds | Watch two students do it |
| Page loads feel instant on school Wi-Fi and phones | Test homework + marks on a phone in a classroom |
| Nobody sees someone else's data | Each teacher/student confirms they only see their own classes |
| Passwords/lockouts | Count "I can't log in" requests; reset via Users → Reset password |
| Backups | Confirm `./backups` has one file per day and copy them off the server |

Keep a shared list of problems: *who, what screen, what they expected, what happened*. Fix blockers the same day.

## End of the week
- Export grades and attendance CSV for the pilot classes and compare with the paper registers: they must match.
- Decide: ready for the whole school? What must change first? (Open questions for the school are in `docs/V1_PLAN.md` §6.)
- Remove the pilot data or keep it: the school decides. Never keep demo/test accounts with known passwords on the live system.
