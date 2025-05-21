// ✅ This mocks Vosk speech recognition for local development
module.exports.streamToVosk = (filePath, callback) => {
    console.log("🎤 MOCK STT called for:", filePath);
    
    // Simulate a transcribed response (change if needed)
    const mockTranscript = "yes please transfer me";
  
    // Simulate async response
    setTimeout(() => {
      callback(null, mockTranscript);
    }, 500);
  };
  