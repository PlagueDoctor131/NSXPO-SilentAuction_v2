import csv, json

csv_file = "gallery.csv"
json_file = "gallery.json"

items = []
with open(csv_file, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Handle multiple images if present
        images = []
        if "images" in row and row["images"].strip():
            images = [img.strip() for img in row["images"].split(",") if img.strip()]
        elif "img" in row and row["img"].strip():
            images = [row["img"].strip()]
        
        items.append({
            "id": row["id"].strip(),
            "name": row["name"].strip(),
            "donor": row.get("donor", "").strip(),
            "desc": row["desc"].strip(),
            "images": images
        })

with open(json_file, "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2)

print(f"✅ Converted {len(items)} items into {json_file}")
