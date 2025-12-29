
import React from 'react';
import { ALPHABET } from '../constants';

interface LetterProgressProps {
  completedLetters: Set<string>;
  currentIndex: number;
}

const LetterProgress: React.FC<LetterProgressProps> = ({ completedLetters, currentIndex }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] bg-slate-800/60 backdrop-blur-md rounded-2xl p-4 border border-slate-700 flex justify-between items-center gap-1 z-50">
      {ALPHABET.map((letter, idx) => {
        const isCompleted = completedLetters.has(letter);
        const isCurrent = idx === currentIndex;
        
        return (
          <div 
            key={letter}
            className={`
              flex-1 h-10 flex items-center justify-center rounded-lg text-lg font-magic transition-all duration-500
              ${isCompleted ? 'bg-amber-500 text-slate-900 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 
                isCurrent ? 'bg-slate-700 text-amber-400 border-2 border-amber-500' : 'bg-slate-800/50 text-slate-500'}
            `}
          >
            {letter}
          </div>
        );
      })}
    </div>
  );
};

export default LetterProgress;
