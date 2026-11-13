# 5 hurdles: problem → how we solved it → what makes us different

1. **No background workers on serverless.**
   → The bus position is a pure function of time; every poll "catches up" the due events, guarded so two phones never create the same alert twice.
   → Any phone can drive the whole world; no server process to crash mid-demo.

2. **A fast bus slipped through the alert radius between two polls.**
   → Each poll checks the whole time window since the last one, not just "now".
   → Parents never miss "Bus is near", even on slow networks.

3. **Real roads, not straight lines.**
   → Route geometry from OpenStreetMap's OSRM, stop order chosen by comparing real road distances (13.8 km vs 16.1 km).
   → ETA = remaining ROAD distance ÷ the bus's measured speed, so "1 km ≈ 3 min" is honest.

4. **The Noida case: data existed, nobody connected it.**
   → The bus cannot close its trip while any child is scanned on but not off; the school sees "Boarded but NOT in class 3-B", escalating Attendant → In-charge → Principal.
   → We track the CHILD, not just the bus, and we never locate any person.

5. **Getting a judge-proof live demo with zero logins.**
   → `/join` gives every judge a different child; a role bar lets 3 phones play parent, attendant and school in the same live world; automated tests run every scenario against the deployed URL.
   → Anyone can try it alone in one minute.
