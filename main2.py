import json
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

# Dummy dataset (Medical Records)
dummy_data = [
    {"id": "MRN-1001", "name": "Aarav Patel", "condition": "Hypertension", "dob": "1980-05-12"},
    {"id": "MRN-1002", "name": "Priya Sharma", "condition": "Type 2 Diabetes", "dob": "1975-08-23"},
    {"id": "MRN-1003", "name": "Rohan Singh", "condition": "Asthma", "dob": "1992-11-30"},
    {"id": "MRN-1004", "name": "Ananya Gupta", "condition": "Coronary Artery Disease", "dob": "1960-02-14"},
    {"id": "MRN-1005", "name": "Kabir Verma", "condition": "Hyperlipidemia", "dob": "1985-07-09"},
    {"id": "MRN-1006", "name": "Meera Reddy", "condition": "Chronic Kidney Disease", "dob": "1970-12-01"},
    {"id": "MRN-1007", "name": "Aditya Desai", "condition": "Osteoarthritis", "dob": "1955-04-18"},
    {"id": "MRN-1008", "name": "Nisha Kumar", "condition": "Migraine", "dob": "1998-09-25"},
    {"id": "MRN-1009", "name": "Karan Joshi", "condition": "Hypertension", "dob": "1982-01-11"},
    {"id": "MRN-1010", "name": "Sneha Iyer", "condition": "Anemia", "dob": "2001-06-05"}
]

class SearchHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # Handle CORS preflight requests from the browser
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

    def do_GET(self):
        # Parse the URL and query parameters
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/search':
            query_params = urllib.parse.parse_qs(parsed_path.query)
            q = query_params.get('q', [''])[0].lower()

            # Simulating network latency
            time.sleep(0.3)

            if not q:
                results = []
            else:
                # Search by patient name, MRN, or condition
                results = [
                    item for item in dummy_data 
                    if q in item["name"].lower() or 
                       q in item["condition"].lower() or 
                       q in item["id"].lower()
                ]

            # Send headers
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Send JSON payload
            self.wfile.write(json.dumps(results).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    PORT = 8000
    server = HTTPServer(('127.0.0.1', PORT), SearchHandler)
    print(f"Starting simple built-in HTTP server on http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()