import React from 'react';

const SplashScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="text-center">
        <div className="relative">
          <div className="animate-bounce">
            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mx-auto">
              <span className="text-white text-3xl sm:text-4xl md:text-5xl font-bold">Z</span>
            </div>
          </div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 animate-ping">
            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
