import React from 'react';

const SplashScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="mb-8 relative">
          <div className="animate-bounce">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">Z</span>
            </div>
          </div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 animate-ping">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-20"></div>
          </div>
        </div>
        <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent animate-fade-in-up">
          ZEDLOCA
        </h1>
        <p className="mt-4 text-gray-600 text-lg animate-fade-in-up animation-delay-300">
          Loading your local marketplace...
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
