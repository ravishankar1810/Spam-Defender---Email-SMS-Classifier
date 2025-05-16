// Global variables
let currentMode = 'email';

// Dynamically determine API endpoint base URL
const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? `http://${window.location.hostname}:5000` 
    : window.location.origin;

const endpointUrls = {
    email: `${baseUrl}/predict-email`,
    sms: `${baseUrl}/predict-sms`
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set up tab switching
    const tabs = document.querySelectorAll('.navbar li');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Update mode
            currentMode = this.dataset.tab;
            
            // Update UI
            updateUIForMode();
        });
    });
    
    // Set up character counter
    const textarea = document.getElementById('textInput');
    const charCount = document.getElementById('charCount');
    
    textarea.addEventListener('input', function() {
        charCount.textContent = this.value.length;
    });
    
    // Set up Enter key to submit
    textarea.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            classifyText();
        }
    });
    
    // Initial UI setup
    updateUIForMode();
});

function updateUIForMode() {
    const title = document.getElementById('classifier-title');
    const textarea = document.getElementById('textInput');
    
    if (currentMode === 'email') {
        title.textContent = 'Spam Email Classifier';
        textarea.placeholder = 'Enter your email content here...';
    } else {
        title.textContent = 'Spam SMS Classifier';
        textarea.placeholder = 'Enter your SMS message here...';
    }
    
    // Clear previous results
    document.getElementById('result').textContent = '';
    document.getElementById('result').style.background = 'transparent';
    document.getElementById('confidence').textContent = '';
    document.getElementById('processed-text').textContent = '';
    document.getElementById('details').style.display = 'none';
    document.getElementById('charCount').textContent = '0';
    textarea.value = '';
    
    // Reset confidence bar
    document.getElementById('confidence-fill').style.width = '0%';
}

function classifyText() {
    const textContent = document.getElementById('textInput').value.trim();
    const resultElement = document.getElementById('result');
    const confidenceElement = document.getElementById('confidence');
    const processedElement = document.getElementById('processed-text');
    const detailsContainer = document.getElementById('details');
    const confidenceFill = document.getElementById('confidence-fill');
    const classifyButton = document.querySelector("button");
    const loader = document.getElementById('loader');

    if (textContent === "") {
        resultElement.innerText = `Please enter ${currentMode === 'email' ? 'email' : 'SMS'} content!`;
        resultElement.style.color = "#f44336";
        resultElement.style.background = "rgba(244, 67, 54, 0.1)";
        resultElement.style.padding = "10px";
        resultElement.style.borderRadius = "8px";
        detailsContainer.style.display = 'none';
        return;
    }

    // Show loader, hide previous result
    resultElement.textContent = '';
    loader.style.display = 'flex';
    
    // Disable button while processing
    classifyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    classifyButton.style.background = "linear-gradient(to right, #9e9e9e, #757575)";
    classifyButton.style.boxShadow = "0 4px 8px rgba(158, 158, 158, 0.3)";
    classifyButton.style.cursor = "not-allowed";
    classifyButton.disabled = true;

    // Send content to backend
    fetch(endpointUrls[currentMode], {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: textContent })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json().catch(err => {
            throw new Error('Invalid JSON response from server');
        });
    })
    .then(data => {
        // Hide loader
        loader.style.display = 'none';
        
        if (data.error) {
            resultElement.innerText = "Error: " + data.error;
            resultElement.style.color = "white";
            resultElement.style.background = "#f44336";
            resultElement.style.padding = "10px";
            resultElement.style.borderRadius = "8px";
            detailsContainer.style.display = 'none';
        } else {
            // Use case-insensitive comparison for prediction
            const isSpam = data.prediction.toLowerCase() === "spam";
            
            // Set result with icon
            resultElement.innerHTML = isSpam ? 
                '<i class="fas fa-exclamation-triangle"></i> Prediction: Spam' : 
                '<i class="fas fa-check-circle"></i> Prediction: Not Spam';
            
            resultElement.style.color = "white";
            resultElement.style.background = isSpam ? "#f44336" : "#4caf50";
            resultElement.style.padding = "15px";
            resultElement.style.borderRadius = "8px";
            resultElement.style.boxShadow = `0 4px 8px rgba(${isSpam ? '244, 67, 54' : '76, 175, 80'}, 0.2)`;
            
            // Show additional details if available
            if (data.confidence) {
                const confidencePercent = (data.confidence * 100).toFixed(1);
                
                confidenceElement.textContent = `Confidence: ${confidencePercent}%`;
                
                // Animate confidence bar
                setTimeout(() => {
                    confidenceFill.style.width = `${confidencePercent}%`;
                }, 100);
                
                processedElement.textContent = data.cleaned_text || 'No text processing applied';
                detailsContainer.style.display = 'block';
            }
        }
    })
    .catch(error => {
        // Hide loader
        loader.style.display = 'none';
        
        console.error("Error:", error);
        resultElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> Connection error. Please try again.';
        resultElement.style.color = "white";
        resultElement.style.background = "#f44336";
        resultElement.style.padding = "10px";
        resultElement.style.borderRadius = "8px";
        detailsContainer.style.display = 'none';
    })
    .finally(() => {
        // Reset button
        classifyButton.innerHTML = '<i class="fas fa-search"></i> Classify';
        classifyButton.style.background = "linear-gradient(to right, #1a73e8, #4285f4)";
        classifyButton.style.boxShadow = "0 4px 8px rgba(26, 115, 232, 0.3)";
        classifyButton.style.cursor = "pointer";
        classifyButton.disabled = false;
    });
}