import api, { getAllProjects } from './api';

const response = (page: number) => ({ data: {
    content: [{ projectKey: `P${page}` }], page, size: 100, totalElements: 5100, totalPages: 51, hasNext: page < 50,
} });

afterEach(() => jest.restoreAllMocks());

test('loads projects beyond the old silent 50-page truncation and forwards cancellation', async () => {
    const get = jest.spyOn(api, 'get');
    for (let page = 0; page < 51; page++) get.mockResolvedValueOnce(response(page));
    const controller = new AbortController();
    const projects = await getAllProjects(controller.signal);
    expect(projects).toHaveLength(51);
    expect(projects[50].projectKey).toBe('P50');
    expect(get).toHaveBeenCalledTimes(51);
    for (const [, options] of get.mock.calls) expect(options?.signal).toBe(controller.signal);
});
