from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import bcrypt
import jwt
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import json
from uuid import uuid4
from dotenv import load_dotenv

app = Flask(__name__, static_folder="public", static_url_path="")
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")])

# Load environment variables
load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET", "your_jwt_secret_here")
UPLOAD_FOLDER = "public/uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "pdf"}

# Database setup
DB_FILE = "db.json"

def read_db():
    if not os.path.exists(DB_FILE):
        default_data = {
            "news": [],
            "events": [],
            "resources": [],
            "joinEvents": [],
            "registrations": [],
            "admins": [],
            "polls": [],
            "donations": [],
            "settings": {"logo": None}
        }
        with open(DB_FILE, "w") as f:
            json.dump(default_data, f, indent=2)
        return default_data
    with open(DB_FILE, "r") as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=2)

# Initialize admin user
def init_admin():
    data = read_db()
    if not any(admin["username"] == "admin" for admin in data["admins"]):
        hashed_password = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        data["admins"].append({
            "id": str(uuid4()),
            "username": "admin",
            "password": hashed_password
        })
        write_db(data)

init_admin()

# File upload configuration
os.makedirs(os.path.join(UPLOAD_FOLDER, "images"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "logos"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "pdfs"), exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# Middleware to verify JWT
def authenticate_token():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Unauthorized"}), 401
    token = auth_header.split(" ")[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"]), None, None
    except jwt.InvalidTokenError:
        return None, jsonify({"error": "Invalid token"}), 403

# Serve static files
@app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return abort(404)

@app.route("/")
def serve_index():
    if os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return abort(404)

@app.route("/admin.html")
def serve_admin():
    if os.path.exists(os.path.join(app.static_folder, "admin.html")):
        return send_from_directory(app.static_folder, "admin.html")
    return abort(404)

# Custom 404 handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify({"error": "Resource not found", "path": request.path}), 404

# Serve uploaded files
@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    if os.path.exists(os.path.join(UPLOAD_FOLDER, filename)):
        return send_from_directory(UPLOAD_FOLDER, filename)
    return abort(404)

# API Endpoints
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    db = read_db()
    admin = next((admin for admin in db["admins"] if admin["username"] == username), None)
    if not admin or not bcrypt.checkpw(password.encode("utf-8"), admin["password"].encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401
    token = jwt.encode({
        "id": admin["id"],
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=1)
    }, JWT_SECRET, algorithm="HS256")
    return jsonify({"token": token})

# Settings (Logo)
@app.route("/api/settings", methods=["GET"])
def get_settings():
    db = read_db()
    return jsonify(db["settings"])

@app.route("/api/settings/logo", methods=["POST"])
def update_logo():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    logo_url = request.form.get("logoUrl")
    logo_path = logo_url or db["settings"]["logo"]
    if "logo" in request.files:
        file = request.files["logo"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "logos", filename))
            logo_path = f"/uploads/logos/{filename}"
    db["settings"]["logo"] = logo_path
    write_db(db)
    return jsonify({"logo": logo_path})

# News
@app.route("/api/news", methods=["GET"])
def get_news():
    db = read_db()
    return jsonify(db["news"])

@app.route("/api/news", methods=["POST"])
def add_news():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    title = request.form.get("title")
    date = request.form.get("date")
    description = request.form.get("description")
    image_url = request.form.get("imageUrl")
    image_path = image_url
    if "image" in request.files:
        file = request.files["image"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "images", filename))
            image_path = f"/uploads/images/{filename}"
    db["news"].append({
        "id": str(uuid4()),
        "title": title,
        "date": date,
        "description": description,
        "image": image_path
    })
    write_db(db)
    return jsonify({"message": "News added"}), 201

@app.route("/api/news/<id>", methods=["PUT"])
def update_news(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    news = next((item for item in db["news"] if item["id"] == id), None)
    if not news:
        return jsonify({"error": "News not found"}), 404
    title = request.form.get("title")
    date = request.form.get("date")
    description = request.form.get("description")
    image_url = request.form.get("imageUrl")
    image_path = image_url or news["image"]
    if "image" in request.files:
        file = request.files["image"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "images", filename))
            image_path = f"/uploads/images/{filename}"
    news.update({
        "title": title,
        "date": date,
        "description": description,
        "image": image_path
    })
    write_db(db)
    return jsonify({"message": "News updated"})

@app.route("/api/news/<id>", methods=["DELETE"])
def delete_news(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    db["news"] = [item for item in db["news"] if item["id"] != id]
    write_db(db)
    return jsonify({"message": "News deleted"})

# Events
@app.route("/api/events", methods=["GET"])
def get_events():
    db = read_db()
    now = datetime.now()
    events = {
        "running": [
            e for e in db["events"]
            if datetime.strptime(e["date"], "%Y-%m-%d") <= now <= datetime.strptime(e["date"], "%Y-%m-%d") + timedelta(days=1)
        ],
        "upcoming": [
            e for e in db["events"]
            if datetime.strptime(e["date"], "%Y-%m-%d") > now
        ],
        "past": [
            e for e in db["events"]
            if datetime.strptime(e["date"], "%Y-%m-%d") < now
        ]
    }
    return jsonify(events)

@app.route("/api/events", methods=["POST"])
def add_event():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    title = request.form.get("title")
    date = request.form.get("date")
    description = request.form.get("description")
    image_url = request.form.get("imageUrl")
    image_path = image_url
    if "image" in request.files:
        file = request.files["image"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "images", filename))
            image_path = f"/uploads/images/{filename}"
    db["events"].append({
        "id": str(uuid4()),
        "title": title,
        "date": date,
        "description": description,
        "image": image_path
    })
    write_db(db)
    return jsonify({"message": "Event added"}), 201

@app.route("/api/events/<id>", methods=["PUT"])
def update_event(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    event = next((item for item in db["events"] if item["id"] == id), None)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    title = request.form.get("title")
    date = request.form.get("date")
    description = request.form.get("description")
    image_url = request.form.get("imageUrl")
    image_path = image_url or event["image"]
    if "image" in request.files:
        file = request.files["image"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "images", filename))
            image_path = f"/uploads/images/{filename}"
    event.update({
        "title": title,
        "date": date,
        "description": description,
        "image": image_path
    })
    write_db(db)
    return jsonify({"message": "Event updated"})

@app.route("/api/events/<id>", methods=["DELETE"])
def delete_event(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    db["events"] = [item for item in db["events"] if item["id"] != id]
    write_db(db)
    return jsonify({"message": "Event deleted"})

# Resources
@app.route("/api/resources", methods=["GET"])
def get_resources():
    db = read_db()
    return jsonify(db["resources"])

@app.route("/api/resources", methods=["POST"])
def add_resource():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    title = request.form.get("title")
    description = request.form.get("description")
    pdf_url = request.form.get("pdfUrl")
    pdf_path = pdf_url
    if "pdf" in request.files:
        file = request.files["pdf"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "pdfs", filename))
            pdf_path = f"/uploads/pdfs/{filename}"
    db["resources"].append({
        "id": str(uuid4()),
        "title": title,
        "description": description,
        "pdf": pdf_path
    })
    write_db(db)
    return jsonify({"message": "Resource added"}), 201

@app.route("/api/resources/<id>", methods=["PUT"])
def update_resource(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    resource = next((item for item in db["resources"] if item["id"] == id), None)
    if not resource:
        return jsonify({"error": "Resource not found"}), 404
    title = request.form.get("title")
    description = request.form.get("description")
    pdf_url = request.form.get("pdfUrl")
    pdf_path = pdf_url or resource["pdf"]
    if "pdf" in request.files:
        file = request.files["pdf"]
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{uuid4()}{os.path.splitext(file.filename)[1]}")
            file.save(os.path.join(UPLOAD_FOLDER, "pdfs", filename))
            pdf_path = f"/uploads/pdfs/{filename}"
    resource.update({
        "title": title,
        "description": description,
        "pdf": pdf_path
    })
    write_db(db)
    return jsonify({"message": "Resource updated"})

@app.route("/api/resources/<id>", methods=["DELETE"])
def delete_resource(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    db["resources"] = [item for item in db["resources"] if item["id"] != id]
    write_db(db)
    return jsonify({"message": "Resource deleted"})

# Polls
@app.route("/api/polls", methods=["GET"])
def get_polls():
    db = read_db()
    return jsonify(db["polls"])

@app.route("/api/polls", methods=["POST"])
def add_poll():
    user, error, status = authenticate_token()
    if error:
        return error, status
    data = request.get_json()
    question = data.get("question")
    options = data.get("options")
    if not question or not options or len(options) < 2:
        return jsonify({"error": "Question and at least two options required"}), 400
    db = read_db()
    votes = {option: 0 for option in options}
    db["polls"].append({
        "id": str(uuid4()),
        "question": question,
        "options": options,
        "votes": votes
    })
    write_db(db)
    return jsonify({"message": "Poll added"}), 201

@app.route("/api/polls/<id>", methods=["PUT"])
def update_poll(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    data = request.get_json()
    question = data.get("question")
    options = data.get("options")
    if not question or not options or len(options) < 2:
        return jsonify({"error": "Question and at least two options required"}), 400
    db = read_db()
    poll = next((item for item in db["polls"] if item["id"] == id), None)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    votes = {option: poll["votes"].get(option, 0) for option in options}
    poll.update({
        "question": question,
        "options": options,
        "votes": votes
    })
    write_db(db)
    return jsonify({"message": "Poll updated"})

@app.route("/api/polls/<id>", methods=["DELETE"])
def delete_poll(id):
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    db["polls"] = [item for item in db["polls"] if item["id"] != id]
    write_db(db)
    return jsonify({"message": "Poll deleted"})

@app.route("/api/polls/<id>/vote", methods=["POST"])
def vote_poll(id):
    data = request.get_json()
    candidate = data.get("candidate")
    db = read_db()
    poll = next((item for item in db["polls"] if item["id"] == id), None)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    if candidate not in poll["options"]:
        return jsonify({"error": "Invalid candidate"}), 400
    poll["votes"][candidate] += 1
    write_db(db)
    return jsonify({"message": "Vote recorded", "votes": poll["votes"]})

# Registrations
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    db = read_db()
    db["registrations"].append({
        "id": str(uuid4()),
        "name": data.get("name"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "idNumber": data.get("idNumber"),
        "university": data.get("university")
    })
    write_db(db)
    return jsonify({"message": "Registration successful"}), 201

@app.route("/api/registrations", methods=["GET"])
def get_registrations():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    return jsonify(db["registrations"])

# Donations
@app.route("/api/donations", methods=["POST"])
def add_donation():
    data = request.get_json()
    db = read_db()
    db["donations"].append({
        "id": str(uuid4()),
        "phone": data.get("phone", "Anonymous"),
        "transactionId": data.get("transactionId"),
        "timestamp": datetime.now().isoformat()
    })
    write_db(db)
    return jsonify({"message": "Donation recorded"}), 201

@app.route("/api/donations", methods=["GET"])
def get_donations():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    return jsonify(db["donations"])

# Join Events
@app.route("/api/join-event", methods=["POST"])
def join_event():
    data = request.get_json()
    db = read_db()
    db["joinEvents"].append({
        "id": str(uuid4()),
        "eventId": data.get("eventId"),
        "name": data.get("name"),
        "email": data.get("email"),
        "phone": data.get("phone")
    })
    write_db(db)
    return jsonify({"message": "Event joined"}), 201

@app.route("/api/join-events", methods=["GET"])
def get_join_events():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    return jsonify(db["joinEvents"])

# Analytics
@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    user, error, status = authenticate_token()
    if error:
        return error, status
    db = read_db()
    analytics = {
        "totalMembers": len(db["registrations"]),
        "totalEventJoins": len(db["joinEvents"]),
        "totalDonations": len(db["donations"]),
        "totalVotes": sum(sum(votes.values()) for poll in db["polls"] for votes in [poll["votes"]]),
        "eventJoinBreakdown": {
            join["eventId"]: sum(1 for j in db["joinEvents"] if j["eventId"] == join["eventId"])
            for join in db["joinEvents"]
        }
    }
    return jsonify(analytics)

# Start server
if __name__ == "__main__":
    app.run(port=int(os.getenv("PORT", 3000)), debug=True)