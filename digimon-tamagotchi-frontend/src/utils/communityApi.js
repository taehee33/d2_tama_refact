const COMMUNITY_API_BASE_URL = process.env.REACT_APP_COMMUNITY_API_BASE_URL || "";

function buildCommunityUrl(path) {
  return `${COMMUNITY_API_BASE_URL}${path}`;
}

async function requestCommunity(currentUser, path, options = {}) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(buildCommunityUrl(path), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "커뮤니티 요청을 처리하지 못했습니다.");
  }

  return payload;
}

export async function listShowcasePosts(currentUser) {
  const payload = await requestCommunity(currentUser, "/api/community/showcase/posts");
  return payload.posts || [];
}

export async function getShowcasePostDetail(currentUser, postId) {
  const payload = await requestCommunity(
    currentUser,
    `/api/community/showcase/posts/${encodeURIComponent(postId)}`
  );

  if (payload?.post && Array.isArray(payload.post.comments) && !payload.comments) {
    const { comments = [], ...post } = payload.post;
    return {
      post,
      comments,
    };
  }

  return payload;
}

export async function createShowcasePost(currentUser, body) {
  const payload = await requestCommunity(currentUser, "/api/community/showcase/posts", {
    method: "POST",
    body,
  });

  return payload.post;
}

export async function updateShowcasePost(currentUser, postId, body) {
  const payload = await requestCommunity(
    currentUser,
    `/api/community/showcase/posts/${encodeURIComponent(postId)}`,
    {
      method: "PATCH",
      body,
    }
  );

  return payload.post;
}

export async function deleteShowcasePost(currentUser, postId) {
  return requestCommunity(
    currentUser,
    `/api/community/showcase/posts/${encodeURIComponent(postId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function createShowcaseComment(currentUser, postId, body) {
  return requestCommunity(
    currentUser,
    `/api/community/showcase/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      body,
    }
  );
}

export async function updateShowcaseComment(currentUser, commentId, body) {
  return requestCommunity(
    currentUser,
    `/api/community/showcase/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PATCH",
      body,
    }
  );
}

export async function deleteShowcaseComment(currentUser, commentId) {
  return requestCommunity(
    currentUser,
    `/api/community/showcase/comments/${encodeURIComponent(commentId)}`,
    {
      method: "DELETE",
    }
  );
}
