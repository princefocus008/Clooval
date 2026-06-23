import json
import os
from datetime import datetime
from db.database import SessionLocal, engine
from db.models import User, Provider, Request, Notification, ActivityLog

def parse_date(date_str):
    if not date_str:
        return datetime.utcnow()
    # Replace Z with +00:00 to make it compatible with fromisoformat
    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))

def seed_db():
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "clooval_db.json")
    if not os.path.exists(json_path):
        print(f"Error: seed data file not found at {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    session = SessionLocal()
    try:
        # 1. Seed Users
        print("Seeding Users...")
        users_dict = data.get("users", {})
        for email, user_data in users_dict.items():
            existing_user = session.query(User).filter_by(id=user_data["id"]).first()
            if not existing_user:
                new_user = User(
                    id=user_data["id"],
                    name=user_data["name"],
                    email=user_data["email"],
                    student_id=user_data.get("studentId"),
                    role=user_data["role"],
                    phone=user_data.get("phone"),
                    nationality=user_data.get("nationality"),
                    programme_of_study=user_data.get("programmeOfStudy"),
                    resident=user_data.get("resident"),
                    password_hash=user_data["passwordHash"],
                    is_suspended=user_data.get("isSuspended", False),
                    notification_email=user_data.get("notificationEmail", True),
                    notification_sms=user_data.get("notificationSMS", True),
                    notification_in_app=user_data.get("notificationInApp", True)
                )
                session.add(new_user)

        # Commit Users first as other tables have foreign key constraints referencing users
        session.commit()

        # 2. Seed Providers
        print("Seeding Providers...")
        providers_list = data.get("providers", [])
        for prov_data in providers_list:
            existing_prov = session.query(Provider).filter_by(id=prov_data["id"]).first()
            if not existing_prov:
                new_prov = Provider(
                    id=prov_data["id"],
                    name=prov_data["name"],
                    phone=prov_data["phone"],
                    specialty=prov_data.get("specialty", []),
                    notes=prov_data.get("notes"),
                    rating=prov_data.get("rating", 5)
                )
                session.add(new_prov)

        session.commit()

        # 3. Seed Requests
        print("Seeding Requests...")
        requests_list = data.get("requests", [])
        for req_data in requests_list:
            existing_req = session.query(Request).filter_by(id=req_data["id"]).first()
            if not existing_req:
                new_req = Request(
                    id=req_data["id"],
                    student_id=req_data["studentId"],
                    student_name=req_data["studentName"],
                    student_email=req_data["studentEmail"],
                    student_phone=req_data.get("studentPhone"),
                    category=req_data["category"],
                    description=req_data["description"],
                    photos=req_data.get("photos", []),
                    priority=req_data.get("priority", "normal"),
                    additional_notes=req_data.get("additionalNotes"),
                    status=req_data.get("status", "submitted"),
                    provider_cost=req_data.get("providerCost"),
                    service_charge=req_data.get("serviceCharge"),
                    total_cost=req_data.get("totalCost"),
                    is_quote_accepted=req_data.get("isQuoteAccepted", False),
                    deposit_paid=req_data.get("depositPaid", False),
                    final_paid=req_data.get("finalPaid", False),
                    ready_notes=req_data.get("readyNotes"),
                    operator_notes=req_data.get("operatorNotes"),
                    internal_notes=req_data.get("internalNotes"),
                    provider_id=req_data.get("providerId"),
                    provider_translation=req_data.get("providerTranslation"),
                    cancel_reason=req_data.get("cancelReason"),
                    created_at=parse_date(req_data.get("createdAt"))
                )
                session.add(new_req)

        session.commit()

        # 4. Seed Notifications
        print("Seeding Notifications...")
        notifications_list = data.get("notifications", [])
        for notif_data in notifications_list:
            existing_notif = session.query(Notification).filter_by(id=notif_data["id"]).first()
            if not existing_notif:
                new_notif = Notification(
                    id=notif_data["id"],
                    student_id=notif_data["studentId"],
                    title=notif_data["title"],
                    body=notif_data["body"],
                    is_read=notif_data.get("isRead", False),
                    created_at=parse_date(notif_data.get("createdAt")),
                    request_id=notif_data.get("requestId"),
                    amount=notif_data.get("amount")
                )
                session.add(new_notif)

        session.commit()

        # 5. Seed Activity Logs
        print("Seeding Activity Logs...")
        activities_list = data.get("activities", [])
        for act_data in activities_list:
            existing_act = session.query(ActivityLog).filter_by(id=act_data["id"]).first()
            if not existing_act:
                new_act = ActivityLog(
                    id=act_data["id"],
                    user_id=act_data["userId"],
                    user_name=act_data["userName"],
                    user_email=act_data["userEmail"],
                    action=act_data["action"],
                    details=act_data["details"],
                    created_at=parse_date(act_data.get("createdAt")),
                    request_id=act_data.get("requestId")
                )
                session.add(new_act)

        session.commit()
        print("Database seeding completed successfully!")

    except Exception as e:
        session.rollback()
        print(f"An error occurred during database seeding: {e}")
        raise e
    finally:
        session.close()

if __name__ == "__main__":
    seed_db()
