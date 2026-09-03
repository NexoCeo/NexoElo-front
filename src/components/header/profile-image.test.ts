import { describe, expect, it } from "vitest";
import { defaultProfileImg, getProfileImageUrl, getUploadedImageUrl } from "./profile-image";

describe("getProfileImageUrl", () => {
  it.each([undefined, null, "", "SEM_FOTO", "uploads/SEM_FOTO", "/uploads/SEM_FOTO"])(
    "uses the local placeholder for an absent profile image (%s)",
    (profileImage) => {
      expect(getProfileImageUrl(profileImage)).toBe(defaultProfileImg);
    },
  );

  it("keeps a valid absolute profile image URL", () => {
    const profileImage = "https://example.com/profile.png";

    expect(getProfileImageUrl(profileImage)).toBe(profileImage);
  });

  it("returns an empty URL for an absent generic uploaded image", () => {
    expect(getUploadedImageUrl("SEM_FOTO")).toBe("");
  });
});
