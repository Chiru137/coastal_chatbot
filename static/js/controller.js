angular.module('chatbotApp').controller('ChatController', ['$scope', '$http', '$sce', function($scope, $http, $sce) {
    
    $scope.selectedLanguage = 'en';
    $scope.language = 'en';

    $scope.switchLanguage = function(lang) {
      $scope.language = lang;
      $scope.selectedLanguage = lang;
    };

    $scope.messages = [];
    $scope.userMessage = '';
    $scope.loading = false;
    $scope.initialized = false;
    $scope.language = 'en';

    $scope.checkInitialization = function() {
        $http.get('/api/chat/check_initialization').then(function(response) {
            $scope.initialized = response.data.initialized;
        }, function(error) {
            console.error('Error checking initialization:', error);
        });
    };

    $scope.selectPlant = function(plantType) {
        $scope.loading = true;
        $http.post('/api/chat/select_plant', { plant_type: plantType }).then(function(response) {
            $scope.initialized = true;
            $scope.loading = false;
        }, function(error) {
            console.error('Error initializing plant data:', error);
            $scope.loading = false;
        });
    };

    $scope.sendMessage = function() {
        if ($scope.userMessage.trim() === '') {
            return;
        }

        const userMessage = {
            text: $sce.trustAsHtml($scope.userMessage),
            user: true
        };

        $scope.messages.push(userMessage);

        const data = {
            message: $scope.userMessage,
            language: $scope.language
        };

        $scope.userMessage = '';

        $http.post('/api/chat', data).then(function(response) {
            const botMessage = {
                text: $sce.trustAsHtml(response.data.reply),
                user: false
            };

            $scope.messages.push(botMessage);
        }, function(error) {
            console.error('Error sending message:', error);
        });
    };

    $scope.switchLanguage = function(language) {
        $scope.language = language;
    };

    $scope.resetBot = function() {
        $scope.initialized = false;
        $scope.messages = [];
    };

    $scope.newChat = function() {
        $scope.messages = [];
    };

    $scope.redirectToWeather = function() {
        window.location.href = 'tts/weather.html';
    };

    $scope.checkEnter = function(event) {
        if (event.keyCode === 13) {
            $scope.sendMessage();
        }
    };

    $scope.startVoiceRecognition = function() {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Web Speech API is not supported in this browser.');
            return;
        }

        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = $scope.language === 'en' ? 'en-US' : 'kn-IN';

        recognition.onstart = function() {
            console.log('Voice recognition started.');
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            $scope.$apply(function() {
                $scope.userMessage = transcript;
            });
        };

        recognition.onerror = function(event) {
            console.error('Voice recognition error:', event.error);
        };

        recognition.onend = function() {
            console.log('Voice recognition ended.');
        };

        recognition.start();
    };

    $scope.speakMessage = function(message) {
        $scope.synth = window.speechSynthesis;
    $scope.speaking = false;
    $scope.currentUtterance = null;

    $scope.speakMessage = function(message) {
        if ($scope.speaking) {
            $scope.synth.cancel();
            $scope.speaking = false;
        } else {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = $scope.language === 'en' ? 'en-US' : 'kn-IN';
            
            utterance.onend = function() {
                $scope.$apply(function() {
                    $scope.speaking = false;
                });
            };
            
            $scope.synth.speak(utterance);
            $scope.currentUtterance = utterance;
            $scope.speaking = true;
        }
    };

    $scope.checkInitialization();
}}]);