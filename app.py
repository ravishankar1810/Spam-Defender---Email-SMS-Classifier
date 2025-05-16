import re
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
import joblib
import nltk
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Download NLTK stopwords once
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

stop_words = set(stopwords.words('english'))
ps = PorterStemmer()

# Preprocess function with SMS-specific logic
def preprocess_text(text, is_sms=False):
    text = text.lower()
    if is_sms:
        abbreviations = {
            'u': 'you',
            'r': 'are',
            'gr8': 'great',
            'btw': 'by the way',
            'lol': 'laughing out loud'
        }
        for abbr, full in abbreviations.items():
            text = re.sub(r'\b' + abbr + r'\b', full, text)

    text = re.sub(r'[^a-zA-Z]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    words = [ps.stem(word) for word in text.split() if word not in stop_words]
    return ' '.join(words)

# Train and save models
def train_and_save_models():
    # Use a relative path
    dataset_path = os.path.join(os.path.dirname(__file__), 'D:\codes\project\spamSMS.csv')
    
    # Try different encodings if one fails
    try:
        data = pd.read_csv(dataset_path, encoding='latin-1')
    except:
        try:
            data = pd.read_csv(dataset_path, encoding='utf-8')
        except Exception as e:
            print(f"Error loading dataset: {e}")
            # Create a minimal dataset for demonstration
            data = pd.DataFrame({
                'v1': ['ham', 'spam', 'ham', 'spam'],
                'v2': [
                    'This is a normal message',
                    'URGENT! You have won a prize',
                    'See you tonight',
                    'FREE GIFT just for you'
                ]
            })
    
    # Select relevant columns and rename
    data = data[['v1', 'v2']]
    data.columns = ['label', 'message']
    data['label'] = data['label'].map({'ham': 0, 'spam': 1})

    # Email Model
    data['cleaned_email'] = data['message'].apply(lambda x: preprocess_text(x, is_sms=False))
    X_train_e, X_test_e, y_train_e, y_test_e = train_test_split(data['cleaned_email'], data['label'], test_size=0.2, random_state=42)
    email_pipeline = Pipeline([
        ('vect', CountVectorizer()),
        ('tfidf', TfidfTransformer()),
        ('clf', MultinomialNB())
    ])
    email_pipeline.fit(X_train_e, y_train_e)
    joblib.dump(email_pipeline, 'email_model.pkl')

    # SMS Model
    data['cleaned_sms'] = data['message'].apply(lambda x: preprocess_text(x, is_sms=True))
    X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(data['cleaned_sms'], data['label'], test_size=0.2, random_state=42)
    sms_pipeline = Pipeline([
        ('vect', CountVectorizer()),
        ('tfidf', TfidfTransformer()),
        ('clf', MultinomialNB())
    ])
    sms_pipeline.fit(X_train_s, y_train_s)
    joblib.dump(sms_pipeline, 'sms_model.pkl')

    return email_pipeline, sms_pipeline

# Load or train models
def load_models():
    try:
        email_model = joblib.load('email_model.pkl')
        sms_model = joblib.load('sms_model.pkl')
        print("Models loaded successfully.")
        return email_model, sms_model
    except Exception as e:
        print("Loading failed, training models:", e)
        return train_and_save_models()

# Load models at startup
print("Initializing models...")
email_model, sms_model = load_models()

# Serve the main page
@app.route('/')
def index():
    return render_template('index.html')

# Email prediction endpoint
@app.route('/predict-email', methods=['POST'])
def predict_email():
    data = request.get_json()
    text = data.get('text', '')
    if not text.strip():
        return jsonify({'error': 'Empty text received'}), 400

    cleaned_text = preprocess_text(text, is_sms=False)
    prediction = email_model.predict([cleaned_text])
    proba = email_model.predict_proba([cleaned_text])[0]

    return jsonify({
        'prediction': 'spam' if prediction[0] else 'ham',
        'confidence': float(np.max(proba)),
        'probabilities': {'ham': float(proba[0]), 'spam': float(proba[1])},
        'original_text': text,
        'cleaned_text': cleaned_text
    })

# SMS prediction endpoint
@app.route('/predict-sms', methods=['POST'])
def predict_sms():
    data = request.get_json()
    text = data.get('text', '')
    if not text.strip():
        return jsonify({'error': 'Empty text received'}), 400

    cleaned_text = preprocess_text(text, is_sms=True)
    prediction = sms_model.predict([cleaned_text])
    proba = sms_model.predict_proba([cleaned_text])[0]

    return jsonify({
        'prediction': 'spam' if prediction[0] else 'ham',
        'confidence': float(np.max(proba)),
        'probabilities': {'ham': float(proba[0]), 'spam': float(proba[1])},
        'original_text': text,
        'cleaned_text': cleaned_text
    })

# Run the app
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)