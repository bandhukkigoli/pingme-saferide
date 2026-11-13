-- Demo data. EVERY person here is FAKE. Phone numbers are stored only in masked form.
-- Stop coordinates are public sector centres in Chandigarh (from OpenStreetMap / Nominatim).

INSERT INTO meta (key, value) VALUES ('routes_version', '1');

INSERT INTO schools (id, name) VALUES (1, 'PEC Demo School');

INSERT INTO buses (id, school_id, name, capacity) VALUES
  (4, 1, 'Bus 4', 30),
  (2, 1, 'Bus 2', 24);

-- Bus 4, morning order. Sector 14 comes before Sector 11 so the bus does not zigzag
-- across the sector grid (11 sits right next to PEC in Sector 12).
INSERT INTO stops (id, bus_id, name, lat, lng, seq, is_school) VALUES
  (1, 4, 'Sector 35', 30.7261215, 76.7598867, 0, FALSE),
  (2, 4, 'Sector 22', 30.7334256, 76.7713451, 1, FALSE),
  (3, 4, 'Sector 16', 30.7467597, 76.7775249, 2, FALSE),
  (4, 4, 'Sector 15', 30.7529928, 76.7726540, 3, FALSE),
  (5, 4, 'Sector 14', 30.7598462, 76.7668339, 4, FALSE),
  (6, 4, 'Sector 11', 30.7598707, 76.7844987, 5, FALSE),
  (7, 4, 'PEC School', 30.7664869, 76.7850788, 6, TRUE),
  (8, 2, 'Sector 27', 30.7227459, 76.7984247, 0, FALSE),
  (9, 2, 'Sector 8', 30.7417025, 76.7994536, 1, FALSE),
  (10, 2, 'Sector 9', 30.7474038, 76.7939268, 2, FALSE),
  (11, 2, 'Sector 10', 30.7541885, 76.7889605, 3, FALSE),
  (12, 2, 'PEC School', 30.7664869, 76.7850788, 4, TRUE);
SELECT setval('stops_id_seq', 100);

-- The six children from the reference demo come first (Aarav = id 1, the default scenario target).
INSERT INTO children (id, school_id, name, class_section, tag_code, bus_id, stop_id, parent_name, masked_phone) VALUES
  (1, 1, 'Aarav Sharma', '3-B', 'PM-BAG-2207', 4, 4, 'Rajesh Sharma', '+91 98•••••210'),
  (2, 1, 'Diya Verma', '2-A', 'PM-BAG-1184', 4, 2, 'Neha Verma', '+91 97•••••482'),
  (3, 1, 'Kabir Singh', '5-C', 'PM-BAG-3391', 4, 3, 'Harpreet Singh', '+91 99•••••117'),
  (4, 1, 'Meera Gill', '4-A', 'PM-BAG-2760', 4, 6, 'Simran Gill', '+91 98•••••905'),
  (5, 1, 'Rohan Bansal', '3-B', 'PM-BAG-1902', 4, 1, 'Amit Bansal', '+91 96•••••338'),
  (6, 1, 'Saanvi Arora', '1-C', 'PM-BAG-4415', 4, 5, 'Pooja Arora', '+91 95•••••764'),
  (7, 1, 'Ishaan Mehta', '2-B', 'PM-BAG-5120', 4, 1, 'Vikas Mehta', '+91 98•••••451'),
  (8, 1, 'Ananya Kapoor', '3-B', 'PM-BAG-5233', 4, 2, 'Ritu Kapoor', '+91 97•••••620'),
  (9, 1, 'Vihaan Malhotra', '4-B', 'PM-BAG-5347', 4, 3, 'Sanjay Malhotra', '+91 99•••••873'),
  (10, 1, 'Aditi Chawla', '1-A', 'PM-BAG-5458', 4, 4, 'Kavita Chawla', '+91 98•••••196'),
  (11, 1, 'Arjun Sethi', '5-A', 'PM-BAG-5569', 4, 5, 'Manoj Sethi', '+91 96•••••247'),
  (12, 1, 'Myra Khanna', '2-C', 'PM-BAG-5670', 4, 6, 'Shalini Khanna', '+91 95•••••530'),
  (13, 1, 'Reyansh Gupta', '3-A', 'PM-BAG-6101', 2, 8, 'Rahul Gupta', '+91 98•••••384'),
  (14, 1, 'Kiara Bedi', '4-C', 'PM-BAG-6212', 2, 8, 'Anjali Bedi', '+91 97•••••915'),
  (15, 1, 'Advik Joshi', '1-B', 'PM-BAG-6323', 2, 9, 'Nitin Joshi', '+91 99•••••062'),
  (16, 1, 'Navya Bhatia', '5-B', 'PM-BAG-6434', 2, 9, 'Sonia Bhatia', '+91 98•••••728'),
  (17, 1, 'Dhruv Saini', '2-A', 'PM-BAG-6545', 2, 10, 'Gurpreet Saini', '+91 96•••••409'),
  (18, 1, 'Tara Ahuja', '3-C', 'PM-BAG-6656', 2, 10, 'Meenu Ahuja', '+91 95•••••853'),
  (19, 1, 'Kabir Rana', '4-A', 'PM-BAG-6767', 2, 11, 'Deepak Rana', '+91 98•••••271'),
  (20, 1, 'Zoya Dhillon', '5-C', 'PM-BAG-6878', 2, 11, 'Jaspreet Dhillon', '+91 97•••••694');
SELECT setval('children_id_seq', 100);

INSERT INTO tags (code, child_id, registered)
  SELECT tag_code, id, TRUE FROM children;

-- Fresh tags nobody registered yet: scanning one opens "Register new rider".
INSERT INTO tags (code, child_id, registered) VALUES
  ('PM-BAG-9001', NULL, FALSE),
  ('PM-BAG-9002', NULL, FALSE),
  ('PM-BAG-9003', NULL, FALSE);
