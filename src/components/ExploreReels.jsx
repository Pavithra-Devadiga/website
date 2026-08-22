import React, { useState, useEffect, useRef } from 'react';
import './ExploreReels.css';

export default function ExploreReels({ t, speakFeedback }) {
  const [currentReel, setCurrentReel] = useState(0);
  const containerRef = useRef(null);

  // A curated list of 8-10 educational accessibility YouTube shorts/videos
  const reels = [
    {
      id: "web-a11y",
      videoId: "3f31oufqFSM", // Introduction to Web Accessibility
      title: "What is Web Accessibility?",
      desc: "An introduction to why designing for everyone matters.",
      hashtags: "#a11y #inclusion",
      category: "Basics"
    },
    {
      id: "screen-reader",
      videoId: "dEbl5jvLKGQ", // How a screen reader works
      title: "Screen Readers Explained",
      desc: "Watch how a blind user navigates a website using a screen reader.",
      hashtags: "#screenreader #blind",
      category: "Assistive Tech"
    },
    {
      id: "colorblind",
      videoId: "v=y3hR3c0z_x8", // Colorblindness
      title: "Designing for Colorblindness",
      desc: "Understanding how different types of color vision deficiency affect perception.",
      hashtags: "#colorblind #design",
      category: "Vision"
    },
    {
      id: "sign-lang",
      videoId: "v=Vv_u-R45H-8", // Indian Sign Language
      title: "Indian Sign Language Basics",
      desc: "Learn the alphabet and basic greetings in Indian Sign Language (ISL).",
      hashtags: "#ISL #deaf",
      category: "Language"
    },
    {
      id: "dyslexia",
      videoId: "zafiGBrFkRM", // Dyslexia simulation
      title: "What is Dyslexia?",
      desc: "A simulation of how reading feels for someone with dyslexia.",
      hashtags: "#dyslexia #learning",
      category: "Cognitive"
    },
    {
      id: "voice-control",
      videoId: "v=Q6zK-TfH_wA", // Voice control
      title: "Navigating with Voice",
      desc: "How motor-impaired users control computers entirely with their voice.",
      hashtags: "#voicecontrol #motor",
      category: "Assistive Tech"
    },
    {
      id: "rpwd-act",
      videoId: "v=B_97G_r0eMw", // RPWD Act
      title: "RPWD Act 2016",
      desc: "Understanding the Rights of Persons with Disabilities Act in India.",
      hashtags: "#rights #india",
      category: "Law"
    },
    {
      id: "inclusive-design",
      videoId: "bVdPN5CJ0zU", // Inclusive Design
      title: "The Power of Inclusive Design",
      desc: "When we design for disability, we all benefit.",
      hashtags: "#inclusivedesign #ux",
      category: "Design"
    }
  ];

  // Track scroll position to update current active dot
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Calculate which reel is currently most visible
      const index = Math.round(container.scrollTop / container.clientHeight);
      if (index !== currentReel) {
        setCurrentReel(index);
        
        // Optional: Provide voice feedback when snapping to a new reel
        // if (speakFeedback) {
        //   speakFeedback(reels[index].title);
        // }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentReel, reels, speakFeedback]);

  // Handle keyboard navigation for easier testing
  useEffect(() => {
    const handleKeyDown = (e) => {
      const container = containerRef.current;
      if (!container) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        container.scrollBy({ top: container.clientHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        container.scrollBy({ top: -container.clientHeight, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to extract proper YouTube URL
  // Some IDs in the array might be full watch URLs or just IDs, need to normalize to embed format
  const getEmbedUrl = (videoId) => {
    let id = videoId;
    if (id.includes('v=')) {
      id = id.split('v=')[1].split('&')[0];
    }
    // Autoplay logic can be tricky with iframes, especially multiple on one page.
    // Standard embed for now.
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&controls=1`;
  };

  return (
    <div className="explore-container">
      <div className="phone-frame">
        
        <div className="reels-container" ref={containerRef}>
          {reels.map((reel, index) => (
            <div key={reel.id} className="reel-slide">
              <div className="reel-video-wrapper">
                 <iframe 
                    className="reel-iframe"
                    src={getEmbedUrl(reel.videoId)}
                    title={reel.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                 ></iframe>
              </div>
              
              <div className="reel-overlay-top">
                {reel.category}
              </div>
              
              <div className="reel-overlay-bottom">
                <h3 className="reel-title">{reel.title}</h3>
                <p className="reel-desc">{reel.desc}</p>
                <div className="reel-hashtags">{reel.hashtags}</div>
              </div>

              {/* Show scroll hint only on first slide */}
              {index === 0 && (
                <div className="scroll-hint">
                  <i className="fa-solid fa-chevron-down"></i>
                  <span>Scroll</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Dots */}
        <div className="reel-nav-dots">
          {reels.map((_, index) => (
            <div 
              key={index} 
              className={`nav-dot ${index === currentReel ? 'active' : ''}`}
              onClick={() => {
                const container = containerRef.current;
                if (container) {
                   container.scrollTo({
                     top: index * container.clientHeight,
                     behavior: 'smooth'
                   });
                }
              }}
            ></div>
          ))}
        </div>

      </div>
    </div>
  );
}
