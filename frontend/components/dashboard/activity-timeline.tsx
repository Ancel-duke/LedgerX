'use client';

import { formatDistanceToNow } from 'date-fns';

interface ActivityTimelineProps {
  activities?: any[];
}

export function ActivityTimeline({ activities: propActivities }: ActivityTimelineProps) {
  const activities = propActivities || [];

  const getActionIcon = (action: string) => {
    if (action.toLowerCase().includes('create')) return '➕';
    if (action.toLowerCase().includes('update')) return '✏️';
    if (action.toLowerCase().includes('delete')) return '🗑️';
    if (action.toLowerCase().includes('payment')) return '💳';
    return '📝';
  };

  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4 text-center">No activity yet</p>
      ) : (
        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-neutral-200" />
          {activities.map((activity: any, index: number) => (
            <div key={activity._id || index} className="relative flex gap-4 pb-4">
              <div className="relative z-10 w-4 h-4 bg-neutral-400 rounded-full border-2 border-white mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-neutral-900">
                      <span className="mr-2">{getActionIcon(activity.action)}</span>
                      <span className="font-medium">{activity.action}</span>
                      {activity.entityType && (
                        <span className="text-neutral-600"> • {activity.entityType}</span>
                      )}
                    </p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="text-xs text-neutral-500 mt-1 space-y-1">
                        {activity.entityType === 'PAYMENT' && activity.metadata.invoiceNumber && (
                          <p>
                            Invoice: {activity.metadata.invoiceNumber} • 
                            Amount: ${activity.metadata.amount?.toFixed(2)} • 
                            {activity.metadata.remaining !== undefined && activity.metadata.remaining > 0 && (
                              <span className="text-orange-600"> Balance: ${activity.metadata.remaining.toFixed(2)}</span>
                            )}
                            {activity.metadata.remaining !== undefined && activity.metadata.remaining <= 0 && (
                              <span className="text-green-600"> Fully Paid</span>
                            )}
                          </p>
                        )}
                        {activity.entityType === 'INVOICE' && (
                          <p>
                            Invoice: {activity.metadata.invoiceNumber} • 
                            Total: ${activity.metadata.total?.toFixed(2)} • 
                            Client: {activity.metadata.clientName}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-neutral-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
