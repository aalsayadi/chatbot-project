import { useState } from "react";
import App from "./App.jsx";
import "./landingPage.css";
import screenshotUI from "/ui/assets/icons/pics/screenUI.png";

const AUTHOR_NAME = "Your Name";

function LandingPage() {
  const [isInApp, setIsInApp] = useState(false);

  if (isInApp) {
    return <App />;
  }

  return (
    <main className="appFrame landingPageFrame" aria-label="Landing page">
      <section className="landingPagePanel">
        <div className="landingCopy">
          <p className="landingEyebrow">Care Companion</p>
          <h1 className="landingHeading">
            Support
            <br />
            and
            <br />
            Guidance.
            <br />
          </h1>
          <p className="landingDescription">
            Care Companion is your empathetic AI assistant, designed to provide
            support and answer your questions.
          </p>

          <div className="landingActions">
            <button
              type="button"
              className="landingPageButton"
              onClick={() => setIsInApp(true)}
            >
              Start a Conversation
            </button>
          </div>
        </div>

        <img
          src={screenshotUI}
          alt="Landing page preview"
          className="screenshotUI"
        />

        <p className="landingAuthor" aria-label="Author credit">
          Supervisor: Paulina Stefanović
          <br />
          Creators: Abdulrahman Al-Sayadi, Stern Mary Kanyinda, Phan Thieu Hoa
          Nguyen and Yannick Polzer
        </p>
      </section>
    </main>
  );
}

export default LandingPage;
