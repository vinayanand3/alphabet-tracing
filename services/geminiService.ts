
import { GoogleGenAI, Modality } from '@google/genai';

export const createGeminiSession = async (
  onTranscript: (text: string, role: 'user' | 'model') => void,
  onAudioStart: () => void
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Audio context setup for playback
  let nextStartTime = 0;
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const outputNode = outputAudioContext.createGain();
  outputNode.connect(outputAudioContext.destination);
  const sources = new Set<AudioBufferSourceNode>();

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: 'You are "Sparky", a magical golden dragon companion for kids. Your job is to encourage them as they trace letters of the alphabet using hand gestures. Keep your instructions very short, enthusiastic, and simple. When they finish a letter, celebrate with excitement! You can "see" their progress through the video frames sent to you.',
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
      }
    },
    callbacks: {
      onopen: () => console.log('Gemini Session Opened'),
      onmessage: async (message) => {
        if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
          onAudioStart();
          const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
          const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
          const source = outputAudioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputNode);
          source.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
          sources.add(source);
          source.onended = () => sources.delete(source);
        }
        
        if (message.serverContent?.interrupted) {
          sources.forEach(s => s.stop());
          sources.clear();
          nextStartTime = 0;
        }
      },
      onerror: (e) => console.error('Gemini Error:', e),
      onclose: () => console.log('Gemini Session Closed')
    }
  });

  return sessionPromise;
};
