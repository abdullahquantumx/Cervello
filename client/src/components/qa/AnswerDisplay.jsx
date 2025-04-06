'use client';

import { useState } from 'react';
import { useUserPreferences } from '@/context/UserPrefsProvider';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

export default function AnswerDisplay({ answer, sources = [], isLoading, error, queryId }) {
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const { preferences } = useUserPreferences();
  const { data: session } = useSession();

  const handleCreateTicket = async () => {
    if (!queryId || !session?.user?.id) {
      toast.error('Unable to create ticket: User information missing');
      return;
    }
  
    try {
      setIsCreatingTicket(true);
  
      // Fetch the user's conversation history from the database
      const historyResponse = await fetch(`/api/qa/history?limit=5&page=1`);
      
      if (!historyResponse.ok) {
        throw new Error('Failed to fetch conversation history');
      }
      
      const historyData = await historyResponse.json();
      console.log('History data received:', historyData); // Debug log
      
      // Check if we have history - note the key is 'history' not 'queries'
      let promptHistory = [];
      
      if (historyData.history && historyData.history.length > 0) {
        promptHistory = historyData.history.map(query => ({
          message: query.question,
          timestamp: query.timestamp || query.createdAt,
        }));
      } else {
        // If no history but we have current queryId and answer, use that
        const questionElement = document.querySelector('p.text-lg');
        const currentQuestion = questionElement?.textContent || "Current question";
        
        promptHistory = [{
          message: currentQuestion,
          timestamp: new Date().toISOString()
        }];
        
        // Always include the current question/answer as a fallback
        if (answer) {
          promptHistory.push({
            message: answer,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      console.log('Prompt history to send:', promptHistory); // Debug log
  
      // Send ticket creation request
      const response = await fetch('http://127.0.0.1:5000/create-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id || 'new',
          promptHistory,
          lowConfidenceReason: 'Could not fully understand the error context',
        }),
      });
  
      if (response.ok) {
        const data = await response.json();
        toast.success(`Ticket created successfully: #${data.ticketId || 'N/A'}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Failed to create ticket: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Error connecting to ticket service');
    } finally {
      setIsCreatingTicket(false);
    }
  };
  

  if (error) {
    return (
      <div className="p-4 bg-[#420D0D] border border-[#991B1B] text-red-400 rounded-xl">
        <h3 className="font-bold mb-2 text-white/90">Error</h3>
        <p className="text-sm sm:text-base">{error}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="p-4 sm:p-6 bg-[#111827] rounded-xl shadow-lg border border-[#2d3748]">
        <h2 className="text-xs sm:text-sm font-medium text-white/60 mb-2">Answer</h2>

        {isLoading && !answer && (
          <div className="flex items-center space-x-2 py-4">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-[#3b82f6] rounded-full" />
              <div className="h-2 w-2 bg-[#3b82f6] rounded-full animation-delay-100" />
              <div className="h-2 w-2 bg-[#3b82f6] rounded-full animation-delay-200" />
            </div>
            <p className="text-white/60 text-sm sm:text-base">Generating answer...</p>
          </div>
        )}

        {answer && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-white/90">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        )}

        {sources && sources.length > 0 && preferences?.showSources !== false && (
          <div className="mt-6 pt-4 border-t border-[#2d3748]">
            <h3 className="text-xs sm:text-sm font-medium text-white/60 mb-2 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Sources
            </h3>
            <ul className="space-y-2">
              {sources.map((source, index) => (
                <li key={index} className="text-xs sm:text-sm p-2 sm:p-3 bg-[#0a0e17] rounded-lg border border-[#2d3748]">
                  <div className="font-medium text-white/90">{source.title || 'Untitled Source'}</div>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline text-xs">
                      {source.url}
                    </a>
                  )}
                  {source.snippet && <p className="mt-1 text-xs text-white/70">{source.snippet}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ticket button only */}
        {answer && !isLoading && queryId && (
          <div className="mt-6 pt-4 border-t border-[#2d3748] flex justify-end">
            <button
              onClick={handleCreateTicket}
              disabled={isCreatingTicket}
              className="px-3 py-1 text-xs sm:text-sm text-white bg-[#3b82f6] rounded-md hover:bg-[#2563eb] transition disabled:opacity-50"
            >
              <span className="flex items-center">
                {isCreatingTicket ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4zm2 5.29A7.96 7.96 0 014 12H0c0 3.04 1.13 5.82 3 7.94l3-2.65z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    Create Ticket
                  </>
                )}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}