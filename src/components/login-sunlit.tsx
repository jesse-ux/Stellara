export function LoginSunlit() {
  return (
    <div aria-hidden="true" className="login-sunlit">
      <svg className="login-sunlit__filter" focusable="false" aria-hidden="true">
        <defs>
          <filter id="loginSunlitHaze" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" numOctaves="3" seed="11">
              <animate
                attributeName="baseFrequency"
                dur="20s"
                keyTimes="0;0.33;0.66;1"
                values="0.002 0.006;0.004 0.012;0.003 0.008;0.002 0.006"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate
                attributeName="scale"
                dur="26s"
                keyTimes="0;0.25;0.5;0.75;1"
                values="8;12;18;12;8"
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
        </defs>
      </svg>

      <div className="login-sunlit__ambient" />
      <div className="login-sunlit__window">
        <div className="login-sunlit__lamp" />
        <div className="login-sunlit__beam" />
        <div className="login-sunlit__glow" />
        <div className="login-sunlit__bounce" />
        <div className="login-sunlit__dust" />

        <div className="login-sunlit__progressive-blur">
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    </div>
  );
}
