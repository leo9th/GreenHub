import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Search, Filter, CheckCircle, XCircle, Ban, MoreVertical } from "lucide-react";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified" | "suspended">("all");
  const [showActions, setShowActions] = useState<number | null>(null);

  const users = [
    {
      id: 1,
      name: "Amina Yusuf",
      email: "amina@example.com",
      phone: "08012345678",
      joined: "2024-01-15",
      verified: true,
      suspended: false,
      orders: 24,
      products: 8,
      location: "Lagos",
    },
    {
      id: 2,
      name: "Tunde Adebayo",
      email: "tunde@example.com",
      phone: "08098765432",
      joined: "2024-02-20",
      verified: false,
      suspended: false,
      orders: 5,
      products: 12,
      location: "Abuja",
    },
    {
      id: 3,
      name: "Ngozi Okafor",
      email: "ngozi@example.com",
      phone: "08087654321",
      joined: "2024-01-10",
      verified: true,
      suspended: false,
      orders: 45,
      products: 3,
      location: "Enugu",
    },
    {
      id: 4,
      name: "Emeka Nwosu",
      email: "emeka@example.com",
      phone: "08076543210",
      joined: "2023-12-05",
      verified: true,
      suspended: true,
      orders: 12,
      products: 0,
      location: "Lagos",
    },
    {
      id: 5,
      name: "Fatima Mohammed",
      email: "fatima@example.com",
      phone: "08065432109",
      joined: "2024-03-01",
      verified: false,
      suspended: false,
      orders: 2,
      products: 5,
      location: "Kano",
    },
  ];

  const filteredUsers = users.filter((user) => {
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filter === "verified" && !user.verified) return false;
    if (filter === "unverified" && user.verified) return false;
    if (filter === "suspended" && !user.suspended) return false;
    return true;
  });

  const handleVerify = (userId: number) => {
    console.log("Verify user:", userId);
    setShowActions(null);
  };

  const handleSuspend = (userId: number) => {
    if (confirm("Are you sure you want to suspend this user?")) {
      console.log("Suspend user:", userId);
    }
    setShowActions(null);
  };

  const handleDelete = (userId: number) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      console.log("Delete user:", userId);
    }
    setShowActions(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">User Management</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3 max-w-6xl mx-auto flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "all" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setFilter("verified")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "verified" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Verified ({users.filter(u => u.verified).length})
          </button>
          <button
            onClick={() => setFilter("unverified")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "unverified" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Unverified ({users.filter(u => !u.verified).length})
          </button>
          <button
            onClick={() => setFilter("suspended")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === "suspended" ? "bg-[#22c55e] text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            Suspended ({users.filter(u => u.suspended).length})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="px-4 py-4 max-w-6xl mx-auto">
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Stats</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">{user.name}</p>
                          {user.verified && (
                            <CheckCircle className="w-4 h-4 text-[#22c55e]" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">Joined {user.joined}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-800">{user.email}</p>
                      <p className="text-sm text-gray-600">{user.phone}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-800">{user.location}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-800">{user.orders} orders</p>
                      <p className="text-sm text-gray-600">{user.products} products</p>
                    </td>
                    <td className="px-4 py-4">
                      {user.suspended ? (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          Suspended
                        </span>
                      ) : user.verified ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          Verified
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setShowActions(showActions === user.id ? null : user.id)}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>

                        {showActions === user.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowActions(null)}
                            />
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-40">
                              <Link
                                to={`/admin/users/${user.id}`}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm"
                              >
                                View Details
                              </Link>
                              {!user.verified && (
                                <button
                                  onClick={() => handleVerify(user.id)}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 w-full text-sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Verify
                                </button>
                              )}
                              {!user.suspended ? (
                                <button
                                  onClick={() => handleSuspend(user.id)}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700 w-full text-sm"
                                >
                                  <Ban className="w-4 h-4" />
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSuspend(user.id)}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-[#22c55e] w-full text-sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Unsuspend
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-red-600 w-full text-sm"
                              >
                                <XCircle className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
