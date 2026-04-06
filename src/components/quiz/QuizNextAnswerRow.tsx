interface QuizNextAnswerRowProps {
  onNext: () => void;
  hardActive: boolean;
  easyActive: boolean;
  onTag: (type: 'hard' | 'easy') => void;
}

export function QuizNextAnswerRow({ onNext, hardActive, easyActive, onTag }: QuizNextAnswerRowProps) {
  return (
    <div className="artikl-next-row artikl-next-row-show">
      <button
        type="button"
        className={`artikl-tag-icon artikl-tag-icon-hard ${hardActive ? 'artikl-tag-icon-on' : ''}`}
        title="Çətin"
        onClick={() => onTag('hard')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1L8.8 5.2H13L9.6 7.8L10.9 12L7 9.5L3.1 12L4.4 7.8L1 5.2H5.2L7 1Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button type="button" className="artikl-next-btn" onClick={onNext}>
        Növbəti →
      </button>
      <button
        type="button"
        className={`artikl-tag-icon artikl-tag-icon-easy ${easyActive ? 'artikl-tag-icon-on' : ''}`}
        title="Asandır"
        onClick={() => onTag('easy')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <polyline
            points="2,7 5.5,10.5 12,3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
