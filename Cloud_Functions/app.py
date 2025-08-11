from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import bigquery
from google.oauth2 import service_account
import os, json

app = Flask(__name__)
CORS(app) 

PROJECT_ID = 'svaraflow'
DATASET_ID = 'test_realtime_events'
SERVICE_ACCOUNT_KEY_PATH = "key.json"
NOTIFICATIONS_FILE = 'notifications.json'

def load_notifications_from_file():
    if os.path.exists(NOTIFICATIONS_FILE):
        with open(NOTIFICATIONS_FILE, 'r') as f:
            return json.load(f)
    return {}

try:
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_KEY_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"])
    bigquery_client = bigquery.Client(project=PROJECT_ID, credentials=credentials)
    print("DEBUG: BigQuery client initialized for backend API.")
except Exception as e:
    print(f"ERROR: Failed to initialize clients for backend API: {e}")
    exit(1)

# --- REST API Endpoints ---
@app.route('/api/sellers/<string:seller_id>/products')
def get_seller_products(seller_id):
    query = f"""
    SELECT
        item_id, item_name, item_category, price
    FROM
        `{PROJECT_ID}.{DATASET_ID}.products`
    WHERE
        seller_id = @seller_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("seller_id", "STRING", seller_id)
        ]
    )
    query_job = bigquery_client.query(query, job_config=job_config)
    results = query_job.result()
    products = [dict(row) for row in results]
    return jsonify(products)

@app.route('/api/sellers/<string:seller_id>/notifications')
def get_seller_notifications(seller_id):
    notifications = load_notifications_from_file()
    seller_notifications = notifications.get(seller_id, [])
    return jsonify(seller_notifications)


if __name__ == '__main__':
    app.run(port=5001, debug=True)