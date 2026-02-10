import React from 'react';
import { useOnboarding } from './OnboardingContext';

const OnboardingProgress = ({ currentPage, userRole, currentStep, totalSteps }) => {
  const { completedPages } = useOnboarding();

  // Define page order for progress display
  const pageOrder = userRole === 'buyer'
    ? ['homePage', 'mapPage', 'listingsPage', 'storesPage', 'messagesPage', 'ordersPage']
    : ['homePage', 'mapPage', 'listingsPage', 'inboxPage', 'ordersPage', 'profilePage', 'buyersPage'];

  const currentPageIndex = pageOrder.indexOf(currentPage);
  const completedCount = Object.values(completedPages).filter(Boolean).length;
  const totalPages = pageOrder.length;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">
              Onboarding Progress
            </span>
            <span className="text-sm text-gray-500">
              {completedCount} of {totalPages} completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalPages) * 100}%` }}
            />
          </div>
        </div>

        {/* Page indicators */}
        <div className="flex justify-between items-center">
          {pageOrder.map((page, index) => {
            const isCompleted = completedPages[page];
            const isCurrent = page === currentPage;
            const isUpcoming = index > currentPageIndex;

            return (
              <div key={page} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white animate-pulse'
                      : isUpcoming
                      ? 'bg-gray-300 text-gray-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className={`text-xs mt-1 text-center leading-tight ${
                  isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {page === 'homePage' ? 'Home' :
                   page === 'mapPage' ? 'Map' :
                   page === 'listingsPage' ? 'Listings' :
                   page === 'storesPage' ? 'Stores' :
                   page === 'messagesPage' ? 'Messages' :
                   page === 'ordersPage' ? 'Orders' :
                   page === 'inboxPage' ? 'Inbox' :
                   page === 'profilePage' ? 'Profile' :
                   page === 'buyersPage' ? 'Buyers' : page}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current step indicator */}
        {currentStep !== undefined && totalSteps && (
          <div className="mt-2 text-center">
            <span className="text-xs text-gray-500">
              Step {currentStep + 1} of {totalSteps} on this page
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingProgress;
