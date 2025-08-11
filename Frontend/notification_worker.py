import os, json, time, requests
from google.cloud import pubsub_v1
from google.oauth2 import service_account
import concurrent.futures

# --- CONFIGURATION ---
PROJECT_ID = 'svaraflow'
NOTIFICATION_SUBSCRIPTION_ID = 'seller-notifications-pull'
SERVICE_ACCOUNT_KEY_PATH = "key.json"
BACKEND_API_URL = 'http://localhost:5000/api/notifications/receive'

subscriber = None
subscription_path = None
credentials = None

def initialize_clients():
    global subscriber, subscription_path, credentials
    try:
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_KEY_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        subscriber = pubsub_v1.SubscriberClient(credentials=credentials)
        subscription_path = subscriber.subscription_path(PROJECT_ID, NOTIFICATION_SUBSCRIPTION_ID)
        print("DEBUG: Pub/Sub subscriber client initialized.")
        return True
    except Exception as e:
        print(f"ERROR: Failed to initialize clients: {e}")
        return False

def send_notification_to_backend(payload):
    try:
        response = requests.post(BACKEND_API_URL, json=payload)
        response.raise_for_status()
        print(f"Successfully sent notification to backend API. Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to send notification to backend API: {e}")

def callback(message: pubsub_v1.subscriber.message.Message) -> None:
    print(f"\nReceived message: {message.message_id}")
    try:
        notification_payload = json.loads(message.data.decode("utf-8"))
        
        # Add a timestamp to the payload.
        notification_payload['timestamp'] = int(time.time())
        
        # LOGGING THE RECEIVED PAYLOAD TO ENSURE DATA IS THERE
        print(f"DEBUG: Received message payload: {notification_payload}")

        send_notification_to_backend(notification_payload)
        
        seller_id = notification_payload.get('seller_id', 'N/A')
        print(f"Processed notification for seller {seller_id}.")
        
        message.ack() 
    except Exception as e:
        print(f"ERROR: Unhandled error processing message: {e}. Nacking message.")
        message.nack() 

if __name__ == "__main__":
    if initialize_clients():
        print(f"Listening for messages on {subscription_path}...")
        # Remove the executor argument
        streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
        with subscriber:
            try: 
                streaming_pull_future.result() 
            except KeyboardInterrupt: 
                streaming_pull_future.cancel()
            except Exception as e:
                print(f"An unexpected error occurred in the main loop: {e}")
            finally:
                subscriber.api.transport.close()
    else:
        print("Exiting due to failed client initialization.")