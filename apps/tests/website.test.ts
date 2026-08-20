import { describe, it, expect, beforeAll } from "bun:test";
import axios from "axios";
import { createUser } from "./testUtils";
import { BACKEND_URL } from "./config";

function uniqueUrl() {
    return `https://hdjjhdhdjhdj.com/${Math.random().toString(36).slice(2)}`;
}

describe("Website gets created", () => {
    let token: string;

    beforeAll(async () => {
        const data = await createUser();
        token = data.jwt;
    })

    it("Website not created if url is not present", async () => {
        await expect(
            axios.post(`${BACKEND_URL}/website`, {}, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        ).rejects.toMatchObject({ response: { status: 400 } });
    })

    it("Website is created if url is present", async () => {
        const response = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        expect(response.data.id).not.toBeNull();
    })

    it("Website is not created if the url resolves to a private/internal address", async () => {
        await expect(
            axios.post(`${BACKEND_URL}/website`, {
                url: "http://169.254.169.254/"
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        ).rejects.toMatchObject({ response: { status: 400 } });
    })

    it("Website is not created if the header is not present", async () => {
        await expect(
            axios.post(`${BACKEND_URL}/website`, {
                url: uniqueUrl()
            })
        ).rejects.toMatchObject({ response: { status: 401 } });
    })
})

describe("Can fetch website", () => {
    let token1: string, userId1: string;
    let token2: string, userId2: string;

    beforeAll(async () => {
        const user1 = await createUser();
        const user2 = await createUser();
        token1 = user1.jwt;
        userId1 = user1.id;
        token2 = user2.jwt;
        userId2 = user2.id;
    });

    it("Is able to fetch a website that the user created", async () => {
        const websiteResponse = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: {
                Authorization: `Bearer ${token1}`
            }
        })

        const getWebsiteResponse = await axios.get(`${BACKEND_URL}/status/${websiteResponse.data.id}`, {
            headers: {
                Authorization: `Bearer ${token1}`
            }
        })

        expect(getWebsiteResponse.data.id).toBe(websiteResponse.data.id)
        expect(getWebsiteResponse.data.user_id).toBe(userId1)
    })

    it("Cant access website created by other user", async () => {
        const websiteResponse = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: {
                Authorization: `Bearer ${token1}`
            }
        })

        await expect(
            axios.get(`${BACKEND_URL}/status/${websiteResponse.data.id}`, {
                headers: {
                    Authorization: `Bearer ${token2}`
                }
            })
        ).rejects.toMatchObject({ response: { status: 404 } });
    })
})

describe("List, update, and delete websites", () => {
    let token1: string;
    let token2: string;

    beforeAll(async () => {
        const user1 = await createUser();
        const user2 = await createUser();
        token1 = user1.jwt;
        token2 = user2.jwt;
    });

    it("GET /websites only returns the requesting user's own sites", async () => {
        const created = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        const user1List = await axios.get(`${BACKEND_URL}/websites`, {
            headers: { Authorization: `Bearer ${token1}` }
        });
        const user2List = await axios.get(`${BACKEND_URL}/websites`, {
            headers: { Authorization: `Bearer ${token2}` }
        });

        expect(user1List.data.websites.some((w: { id: string }) => w.id === created.data.id)).toBe(true);
        expect(user2List.data.websites.some((w: { id: string }) => w.id === created.data.id)).toBe(false);
    })

    it("PATCH updates the url for a website the user owns", async () => {
        const created = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        const newUrl = uniqueUrl();
        const patched = await axios.patch(`${BACKEND_URL}/website/${created.data.id}`, {
            url: newUrl
        }, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        expect(patched.data.url).toBe(newUrl);
    })

    it("PATCH on another user's website returns 404", async () => {
        const created = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        await expect(
            axios.patch(`${BACKEND_URL}/website/${created.data.id}`, {
                url: uniqueUrl()
            }, {
                headers: { Authorization: `Bearer ${token2}` }
            })
        ).rejects.toMatchObject({ response: { status: 404 } });
    })

    it("DELETE removes a website the user owns", async () => {
        const created = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        await axios.delete(`${BACKEND_URL}/website/${created.data.id}`, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        await expect(
            axios.get(`${BACKEND_URL}/status/${created.data.id}`, {
                headers: { Authorization: `Bearer ${token1}` }
            })
        ).rejects.toMatchObject({ response: { status: 404 } });
    })

    it("DELETE on another user's website returns 404", async () => {
        const created = await axios.post(`${BACKEND_URL}/website`, {
            url: uniqueUrl()
        }, {
            headers: { Authorization: `Bearer ${token1}` }
        });

        await expect(
            axios.delete(`${BACKEND_URL}/website/${created.data.id}`, {
                headers: { Authorization: `Bearer ${token2}` }
            })
        ).rejects.toMatchObject({ response: { status: 404 } });
    })
})
